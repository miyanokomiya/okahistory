export type ActionName = string

export interface Action<RedoArgs> {
  name: ActionName
  args: RedoArgs
}

export interface Reducer<RedoArgs, UndoArgs> {
  redo(redoState: RedoArgs): UndoArgs
  undo(undoState: UndoArgs): void
  getLabel?: (action: Action<RedoArgs>) => string
}

export interface SavedAction<RedoArgs, UndoArgs> {
  name: ActionName
  redoArgs: RedoArgs
  undoArgs: UndoArgs
}

interface SerializedState {
  version: '0' // independent on the version in package.json
  stack: SavedAction<any, any>[]
}

interface ActionSummary {
  name: ActionName
  label: string
  done: boolean
}

interface HistoryModule {
  registReducer<UndoArgs, RedoArgs>(
    name: ActionName,
    reducer: Reducer<RedoArgs, UndoArgs>
  ): void
  execAction<RedoArgs>(action: Action<RedoArgs>): void
  redo(): void
  undo(): void
  getCurrentIndex(): number
  getActionSummaries(): ActionSummary[]
  serialize(): SerializedState
  deserialize(state: SerializedState): void
}

export function useHistory(): HistoryModule {
  const reducerMap: { [name: ActionName]: Reducer<any, any> } = {}
  let historyStack: SavedAction<any, any>[] = []
  let currentStackIndex = -1

  function registReducer<UndoArgs, RedoArgs>(
    name: ActionName,
    reducer: Reducer<RedoArgs, UndoArgs>
  ) {
    reducerMap[name] = reducer
  }

  function execAction<RedoArgs>(action: Action<RedoArgs>): void {
    const reducer = getReducer(reducerMap, action.name)
    const undoArgs = reducer.redo(action.args)

    pushHistory({
      name: action.name,
      redoArgs: action.args,
      undoArgs,
    })
  }

  function pushHistory(savedAction: SavedAction<any, any>): void {
    if (currentStackIndex < historyStack.length - 1) {
      historyStack.splice(
        currentStackIndex + 1,
        historyStack.length - currentStackIndex
      )
    }
    historyStack.push(savedAction)
    currentStackIndex = historyStack.length - 1
  }

  function redo() {
    if (currentStackIndex < historyStack.length - 1) {
      const current = historyStack[currentStackIndex + 1]
      reducerMap[current.name].redo(current.redoArgs)
      currentStackIndex = currentStackIndex + 1
    }
  }

  function undo() {
    if (-1 < currentStackIndex) {
      const current = historyStack[currentStackIndex]
      reducerMap[current.name].undo(current.undoArgs)
      currentStackIndex = currentStackIndex - 1
    }
  }

  function getActionSummaries(): ActionSummary[] {
    return historyStack.map((a, i) => {
      const reducer = getReducer(reducerMap, a.name)
      return {
        name: a.name,
        label: reducer.getLabel?.({ name: a.name, args: a.redoArgs }) ?? a.name,
        done: i <= currentStackIndex,
      }
    })
  }

  function serialize(): SerializedState {
    return { version: '0', stack: historyStack }
  }

  /**
   * just deserializes and does not call redo operations
   */
  function deserialize(state: SerializedState): void {
    historyStack = state.stack.concat()
    currentStackIndex = historyStack.length - 1
  }

  return {
    registReducer,
    execAction,
    redo,
    undo,
    getCurrentIndex: () => currentStackIndex,
    getActionSummaries,
    serialize,
    deserialize,
  }
}

function getReducer(
  reducerMap: { [name: ActionName]: Reducer<any, any> },
  name: ActionName
): Reducer<any, any> {
  const reducer = reducerMap[name]
  if (!reducer) throw new Error(`not found a reducer for the action: ${name}`)
  return reducer
}
