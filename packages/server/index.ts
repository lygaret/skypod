import express from 'express'
import { router } from 'express-file-routing'
import { ExpressPeerServer } from 'peer'
import path from 'node:path'
import { AddressInfo } from 'node:net';

const app = express();
const server = app.listen(7890);

const routes = path.join(import.meta.dirname, 'api')
app.use("/api", await router({ directory: routes }));

const peerServer = ExpressPeerServer(server, {})
app.use("/sync", peerServer)

// this is the app (placed there by dist script)
const distAssets = path.join(import.meta.dirname, 'dist')
app.use(express.static(distAssets))

// this is normal assets
const publicAssets = path.join(import.meta.dirname, 'public')
app.use(express.static(publicAssets))

const addr = server.address() as AddressInfo;
console.log(`server is listening @ http://[${addr.address}]:${addr.port}`)
