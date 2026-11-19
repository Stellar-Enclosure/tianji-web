import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import react from '@vitejs/plugin-react'
import {loadEnv} from 'vite'
import {egonFaviconPlugin} from '@stellar-enclosure/stellar-enclosure-web-shared/vite-plugin'
import {defineConfig} from 'vitest/config'

export default defineConfig(async ({command, mode}) => {
  const permissionPlugins: import('vite').PluginOption[] = []
  if (command === 'build') {
    if (!process.env.PAC_SDK_DIR) throw new Error('PAC_SDK_DIR_REQUIRED')
    const plugin = await import(pathToFileURL(resolve(process.env.PAC_SDK_DIR, 'scripts/permissions/consumer-vite-plugin.mjs')).href)
    permissionPlugins.push(plugin.permissionBuildPlugin())
  }
  const configuredBase = loadEnv(mode, process.cwd(), 'VITE_').VITE_BASE_PATH ?? '/'
  if (!configuredBase.startsWith('/') || configuredBase.startsWith('//') || /[\\?#%]/.test(configuredBase)
      || /\/{2,}/.test(configuredBase) || [...configuredBase].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
      || configuredBase.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('Invalid VITE_BASE_PATH')
  const base = configuredBase === '/' ? '/' : configuredBase.replace(/\/?$/, '/')
  return {
    base,
    plugins: [react(), egonFaviconPlugin(), ...permissionPlugins],
    resolve: {dedupe: ['react', 'react-dom', 'react-router-dom', 'antd', '@tanstack/react-query', 'i18next', 'react-i18next']},
    server: {host: '127.0.0.1', port: 18153, strictPort: true},
    test: {environment: 'jsdom', globals: true, fileParallelism: false, setupFiles: './src/test/setup.ts'},
    build: {sourcemap: false, chunkSizeWarningLimit: 900},
  }
})
