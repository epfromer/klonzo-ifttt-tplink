// import axios from 'axios'
import * as dotenv from 'dotenv'
import crypto from 'crypto';
import https from 'https';
import { v4 } from 'uuid'
import axios from 'axios';

dotenv.config()

const url = 'https://wap.tplinkcloud.com'
const VERBOSE = process.env.VERBOSE === '1'

let cachedDeviceList: Array<any> = []

/**
 * Handle this problem with Node 18
 * write EPROTO B8150000:error:0A000152:SSL routines:final_renegotiate:unsafe legacy renegotiation disabled
 * see https://stackoverflow.com/questions/74324019/allow-legacy-renegotiation-for-nodejs/74600467#74600467
 **/
const allowLegacyRenegotiationforNodeJsOptions = {
  httpsAgent: new https.Agent({
    // for self signed you could also add
    // rejectUnauthorized: false,
    // allow legacy server
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
  }),
};

const connect = async () => {
  const terminalUUID = v4()
  let r
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'login',
        params: {
          appType: 'Kasa_Android',
          cloudUserName: process.env.TPLINK_USER,
          cloudPassword: process.env.TPLINK_PWD,
          terminalUUID,
        },
      }),
      // @ts-ignore
      dispatcher: new Agent({
        connect: {
          rejectUnauthorized: false,
          secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
        }
      })
    })
  } catch (error) {
    console.error('error: connect fetch error', error)
    return { terminalUUID: null, token: null }
  }
  const json: any = await r.json()
  if (VERBOSE) console.log('success! connect json', json)

  if (json && json.error_code && json.msg) {
    console.error('error: connect error', json.error_code, json.msg)
    return { terminalUUID: null, token: null }
  }

  const token =
    json && json.result && json.result.token ? json.result.token : ''
  return { terminalUUID, token }
}

const connectAxios = async () => {
  const terminalUUID = v4()
  let token = null

  await axios({
    ...allowLegacyRenegotiationforNodeJsOptions,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method: 'POST',
    data: {
      method: 'login',
      params: {
        appType: 'Kasa_Android',
        cloudUserName: process.env.TPLINK_USER,
        cloudPassword: process.env.TPLINK_PWD,
        terminalUUID,
      },
    },
  })
    .then(function (response) {
      console.log("success response = ", response);
      // token =
      //   response && response.result && response.result.token ? response.result.token : ''
    })
    .catch(function (error) {
      console.log("error", error);
    });

  console.log("terminalUUID, token", terminalUUID, token)
  return { terminalUUID, token }
}

export async function getDevices() {
  if (cachedDeviceList.length > 0) {
    if (VERBOSE) {
      console.log('getDevices returning cached list', cachedDeviceList)
    }
    return cachedDeviceList
  }

  const { terminalUUID, token } = await connectAxios()
  // const { terminalUUID, token } = await connect()
  if (!terminalUUID) {
    console.error('error: getDevices no tplink terminalUUID')
    return
  }

  // get device list
  let r
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'getDeviceList',
        params: {
          appType: 'Kasa_Android',
          token,
          terminalUUID,
        },
      }),
    })
  } catch (error) {
    console.error('error: getDevices fetch error', error)
    return []
  }
  const json: any = await r.json()
  if (VERBOSE) console.log('getDevices', json)
  if (
    !json.result ||
    !json.result.deviceList ||
    !json.result.deviceList.length
  ) {
    console.error('error: getDevices device list null or empty', json)
    return []
  }
  if (VERBOSE) {
    console.log('getDevices caching list', json.result.deviceList)
  }
  cachedDeviceList = json.result.deviceList
  return json.result.deviceList
}

export async function turnDeviceOn(deviceId: string) {
  const devices = await getDevices()
  if (!devices || !devices.length) {
    console.error('error: getDevices no TPLINK devices found')
    return
  }
  const device = devices.find((dev: any) => dev.deviceId === deviceId)
  if (!device) {
    console.error(`error: turnDeviceOn TPLINK device ${deviceId} not found`)
    return
  }
  const { terminalUUID, token } = await connect()
  if (!terminalUUID) {
    console.error('error: turnDeviceOn no tplink terminalUUID')
    return
  }
  console.log('turnDeviceOn', deviceId)
  try {
    await fetch(device.appServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'passthrough',
        params: {
          appType: 'Kasa_Android',
          token,
          terminalUUID,
          deviceId,
          requestData: {
            system: { set_relay_state: { state: 1 } },
          },
        },
      }),
    })
  } catch (error) {
    console.error('error: turnDeviceOn fetch error', error)
  }
}

export async function turnDeviceOff(deviceId: string) {
  const devices = await getDevices()
  if (!devices || !devices.length) {
    console.error('error: turnDeviceOff no TPLINK devices found')
    return
  }
  const device = devices.find((dev: any) => dev.deviceId === deviceId)
  if (!device) {
    console.error(`error: turnDeviceOff TPLINK device ${deviceId} not found`)
    return
  }
  const { terminalUUID, token } = await connect()
  if (!terminalUUID) {
    console.error('error: turnDeviceOff no tplink terminalUUID')
    return
  }
  console.log('turnDeviceOff', deviceId)
  try {
    await fetch(device.appServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'passthrough',
        params: {
          appType: 'Kasa_Android',
          token,
          terminalUUID,
          deviceId,
          requestData: {
            system: { set_relay_state: { state: 0 } },
          },
        },
      }),
    })
  } catch (error) {
    console.error('error: turnDeviceOff fetch error', error)
  }
}
