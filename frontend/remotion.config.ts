/**
 * Remotion 設定ファイル
 */

import { Config } from '@remotion/cli/config';
import path from 'path';

Config.setEntryPoint('./remotion/index.ts');
Config.setOutputLocation('./out');

// Windows でのモジュール解決問題を修正
Config.overrideWebpackConfig((config) => {
  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '@remotion/studio/renderEntry': path.resolve(
          __dirname,
          'node_modules/@remotion/studio/dist/renderEntry.js'
        ),
      },
    },
  };
});
