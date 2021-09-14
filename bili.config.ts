import { Config } from 'bili'

const config: Config = {
  plugins: {
    typescript2: {
      tsconfigOverride: {
        include: ['src'],
      },
    },
  },
  input: 'src/okahistory.ts',
  output: {
    format: ['cjs-min', 'esm-min', 'umd-min'],
    moduleName: 'okahistory',
  },
  banner: true,
}

export default config
