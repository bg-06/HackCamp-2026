import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { createApp } from './api.js'
import { createAuthMiddleware, loadAuth0Settings } from './auth.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
config({ path: [join(root, '.env'), join(root, 'env')] })
const authentication = createAuthMiddleware(loadAuth0Settings())
const { sql } = await import('../lib/db.js')
const port = Number(process.env.PORT ?? 8000)
createApp(sql, authentication).listen(port, () => console.log(`API listening on http://localhost:${port}`))
