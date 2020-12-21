/* @flow */

import type VueRouter from './index'
import { resolvePath } from './util/path'
import { assert, warn } from './util/warn'
import { createRoute } from './util/route'
import { fillParams } from './util/params'
import { createRouteMap } from './create-route-map'
import { normalizeLocation } from './util/location'
import { checkMFEProperties } from './util/helper'

export type Matcher = {
  match: (
    raw: RawLocation,
    current?: Route,
    redirectedFrom?: Location
  ) => Route,
  addRoutes: (routes: Array<RouteConfig>) => void
}

export function createMatcher (
  routes: Array<RouteConfig>,
  router: VueRouter
): Matcher {
  const { pathList, pathMap, nameMap } = createRouteMap(routes)

  function addRoutes (routes) {
    createRouteMap(routes, pathList, pathMap, nameMap)
  }

  function match (
    raw: RawLocation,
    currentRoute?: Route,
    redirectedFrom?: Location
  ): Route {
    const location = normalizeLocation(raw, currentRoute, false, router)
    const { name } = location

    if (name) {
      const record = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        warn(record, `Route with name '${name}' does not exist`)
      }
      if (!record) return _createRoute(null, location)
      const paramNames = record.regex.keys
        .filter(key => !key.optional)
        .map(key => key.name)

      if (typeof location.params !== 'object') {
        location.params = {}
      }

      if (currentRoute && typeof currentRoute.params === 'object') {
        for (const key in currentRoute.params) {
          if (!(key in location.params) && paramNames.indexOf(key) > -1) {
            location.params[key] = currentRoute.params[key]
          }
        }
      }
      location.path = fillParams(
        record.path,
        location.params,
        `named route "${name}"`
      )
      // location.path +="/"
      return _createRoute(record, location, redirectedFrom)
    } else if (location.path) {
      location.params = {}
      let routeExists: boolean = false
      for (let i = 0; i < pathList.length; i++) {
        const path = pathList[i]
        let record = pathMap[path]
        if (matchRoute(record.regex, location.path, location.params)) {
          routeExists = true
          let mfeRouteExists = false
          let mferecord = null
          /**
           * For the routes that aren't present and we are adding those,
           * remove the actual route that is present in the pathlist and push that one to the last
           * This is to be done becuase route matching will match the earlier one and not the one we are adding here.
           */
          if (
            record.path.indexOf(':') !== -1 &&
            checkMFEProperties(record.mfes)
          ) {
            mfeRouteExists = false
            for (let j = i + 1; j < pathList.length; j++) {
              const mfepath = pathList[j]
              mferecord = pathMap[mfepath]
              if (matchRoute(mferecord.regex, location.path, location.params)) {
                mfeRouteExists = true
                break
              }
            }
          }
          if (mfeRouteExists) {
            record = mferecord
          }
          /**
           * When a nested mfe child is opened in url, we save that in mferedirect path
           * so when any other path is opened, check for that redirect path in the parent mfes
           * route config and add that for this path as well.
           */
          // let mferedirectPath = record.mferedirect
          // let parentItr = record
          // while (parentItr) {
          //   if (
          //     parentItr.mferedirect &&
          //     parentItr.mfes &&
          //     checkMFEProperties(parentItr.mfes)
          //   ) {
          //     mferedirectPath = parentItr.mferedirect
          //   }
          //   parentItr = parentItr.parent;
          // }
          // record.mferedirect = mferedirectPath;
          // if (record.mferedirect) {
          //   record.mferedirect = undefined;
          // }
          return _createRoute(record, location, redirectedFrom)
        }
      }
      if (!routeExists) {
        const pathSplit = location.path.split('/')
        const routePathsLength = pathSplit.length
        for (let i = 0; i < routePathsLength; i++) {
          pathSplit.pop()
          const possibleMfePath = pathSplit.join('/')
          const matchedRecord = Object.values(pathMap).find(record =>
            record.regex.test(possibleMfePath)
          )
          if (
            matchedRecord &&
            matchedRecord.mfes &&
            checkMFEProperties(matchedRecord.mfes) &&
            matchRoute(matchedRecord.regex, possibleMfePath, location.params)
          ) {
            const redirectRecord: RouteRecord = Object.assign(
              {},
              pathMap[matchedRecord.path]
            )
            // redirectRecord.mferedirect = location.path
            redirectRecord.redirect = possibleMfePath
            let queryString
            if (location.query) {
              queryString = Object.keys(location.query)
                .map(key => key + '=' + location.query[key])
                .join('&')
            }
            /**
             * This is to ensure that mferedirect path is set only once
             * As for subsequent routing the paths will already have been added
             * and should directly route to the child path
             */
            if (!pathMap[redirectRecord.path]['mferedirect']) {
              pathMap[redirectRecord.path]['mferedirect'] =
                location.path + (queryString ? `?${queryString}` : '')
            }
            return _createRoute(redirectRecord, location, redirectedFrom)
          }
        }
      }
    }
    // no match
    return _createRoute(null, location)
  }

  function redirect (record: RouteRecord, location: Location): Route {
    const originalRedirect = record.redirect
    let redirect =
      typeof originalRedirect === 'function'
        ? originalRedirect(createRoute(record, location, null, router))
        : originalRedirect

    if (typeof redirect === 'string') {
      redirect = { path: redirect }
    }

    if (!redirect || typeof redirect !== 'object') {
      if (process.env.NODE_ENV !== 'production') {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
      }
      return _createRoute(null, location)
    }

    const re: Object = redirect
    const { name, path } = re
    let { query, hash, params } = location
    query = re.hasOwnProperty('query') ? re.query : query
    hash = re.hasOwnProperty('hash') ? re.hash : hash
    params = re.hasOwnProperty('params') ? re.params : params

    if (name) {
      // resolved named direct
      const targetRecord = nameMap[name]
      if (process.env.NODE_ENV !== 'production') {
        assert(
          targetRecord,
          `redirect failed: named route "${name}" not found.`
        )
      }
      return match(
        {
          _normalized: true,
          name,
          query,
          hash,
          params
        },
        undefined,
        location
      )
    } else if (path) {
      // 1. resolve relative redirect
      const rawPath = resolveRecordPath(path, record)
      // 2. resolve params
      const resolvedPath = fillParams(
        rawPath,
        params,
        `redirect route with path "${rawPath}"`
      )
      // 3. rematch with existing query and hash
      return match(
        {
          _normalized: true,
          path: resolvedPath,
          query,
          hash
        },
        undefined,
        location
      )
    } else {
      if (process.env.NODE_ENV !== 'production') {
        warn(false, `invalid redirect option: ${JSON.stringify(redirect)}`)
      }
      return _createRoute(null, location)
    }
  }

  function alias (
    record: RouteRecord,
    location: Location,
    matchAs: string
  ): Route {
    const aliasedPath = fillParams(
      matchAs,
      location.params,
      `aliased route with path "${matchAs}"`
    )
    const aliasedMatch = match({
      _normalized: true,
      path: aliasedPath
    })
    if (aliasedMatch) {
      const matched = aliasedMatch.matched
      const aliasedRecord = matched[matched.length - 1]
      location.params = aliasedMatch.params
      return _createRoute(aliasedRecord, location)
    }
    return _createRoute(null, location)
  }

  function _createRoute (
    record: ?RouteRecord,
    location: Location,
    redirectedFrom?: Location
  ): Route {
    if (record && record.redirect) {
      return redirect(record, redirectedFrom || location)
    }
    if (record && record.matchAs) {
      return alias(record, location, record.matchAs)
    }
    return createRoute(record, location, redirectedFrom, router)
  }

  return {
    match,
    addRoutes
  }
}

function matchRoute (regex: RouteRegExp, path: string, params: Object): boolean {
  const m = path.match(regex)

  if (!m) {
    return false
  } else if (!params) {
    return true
  }

  for (let i = 1, len = m.length; i < len; ++i) {
    const key = regex.keys[i - 1]
    const val = typeof m[i] === 'string' ? decodeURIComponent(m[i]) : m[i]
    if (key) {
      // Fix #1994: using * with props: true generates a param named 0
      params[key.name || 'pathMatch'] = val
    }
  }

  return true
}

function resolveRecordPath (path: string, record: RouteRecord): string {
  return resolvePath(path, record.parent ? record.parent.path : '/', true)
}
