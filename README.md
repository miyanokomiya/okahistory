![Main](https://github.com/miyanokomiya/okahistory/workflows/Main/badge.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# okahistory
This is a convenient tool for the features of undo-redo operations.  

## usage

```sh
yarn add okahistory
```

```ts
import type { Reducer } from 'okahistory'
import { useHistory } from 'okahistory'

const state = { count: 0 }
const history = useHistory()

// define your reducers
const reducerA: Reducer<number, number> = {
  redo(after) {
    const before = state.count
    state.count = after
    return before
  },
  undo(before) {
    state.count = before
  },
}
const { dispatch, createAction } = history.defineReducers({ ACTION_A: reducerA })

// dispatch an action
dispatch(createAction('ACTION_A', 1))

// undo & redo
history.undo()
history.redo()
```

## commnad

```sh
# install dependencies
$ yarn install

# lint
$ yarn lint

# test
$ yarn test [--watch]

# build
$ yarn build
```

## publish
Update `version` in `package.json`, commit with a comment `Release x.x.x` and merge into the `main` branch.
