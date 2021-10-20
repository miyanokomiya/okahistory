# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

## [0.0.8] - 2021-10-20
### Added
- Add `avoidOverriding` option to avoid overriding duplicated reducers.

## [0.0.7] - 2021-10-14
### Changed
- `dispatch` can accept `undefined` as an action, and it is just ignored.

## [0.0.6] - 2021-10-13
### Added
- `onUpdated` callback can be passed as an option.
- `jump` method can be used to change current index of the history.

## [0.0.5] - 2021-10-13
### Added
- `dispatch` can accept actions as 2nd arg, and those actions belong to the action of 1st arg.

### Changed
- [breaking] `defineReducers` does not return `dispatch` directly but returns `{ dispatch, createAction }`.
- `createAction` is useful to create typed actions defined by `defineReducers`.

## [0.0.4] - 2021-10-12
### Added
- Add new method to define reducers that returns a function to dispatch the actions.

### Changed
- Update dependencies.
