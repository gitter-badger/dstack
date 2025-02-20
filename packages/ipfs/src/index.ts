// @ts-expect-error: no types
import WebRTCStar from 'libp2p-webrtc-star'
// @ts-expect-error: no types
import WebSocket from 'libp2p-websockets'
import { create as IPFSCreate, PeerId, CID } from 'ipfs'
import type { IPFS, Options as IPFSOptions } from 'ipfs-core'
import { listen } from './addresses'

const create = (options?: IPFSOptions, wrtc?: any): Promise<IPFS> => {
  return IPFSCreate({
    config: {
      Discovery: {
        webRTCStar: { Enabled: true }
      },
      Addresses: {
        Swarm: listen
      },
      Bootstrap: [
        '/dns4/relay.dstack.dev/tcp/443/wss/p2p-webrtc-star/p2p/QmV2uXBKbii29iJKHKVy8sx5m49qdDTBYNybVoa5uLJtrf'
      ],
      ...options?.config
    },
    ...options,
    relay: {
      enabled: true,
      hop: {
        enabled: true
      }
    },
    libp2p: {
      ...options?.libp2p,
      modules: {
        transport: [WebRTCStar, WebSocket]
      },
      config: {
        peerDiscovery: {
          webRTCStar: {
            enabled: true
          }
        },
        transport: {
          WebRTCStar: {
            wrtc
          }
        }
      },
      dht: {
        enabled: true,
        kBucketSize: 20
      }
    }
  })
}

export { PeerId, CID, create }
