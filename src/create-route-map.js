/* @flow */

import Regexp from 'path-to-regexp'
import { cleanPath } from './util/path'
import { assert, warn } from './util/warn'
import { checkMFEProperties } from './util/helper'

export function createRouteMap (
  routes: Array<RouteConfig>,
  oldPathList?: Array<string>,
  oldPathMap?: Dictionary<RouteRecord>,
  oldNameMap?: Dictionary<RouteRecord>
): {
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>
} {
  // the path list is used to control path matching priority
  const pathList: Array<string> = oldPathList || []
  // $flow-disable-line
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null)
  // $flow-disable-line
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null)

  routes.forEach(route => {
    let mfeParentRoute
    /**
     * find if any children of mfe are non root and requiring routing then they must
     * be added with the parent link
     */
    if ((route.mfe || route.mfes) && route.children) {
      /**
       * It the path to be matched is an mfe and chlidren are present for that
       * then, calcualte the parent for this route from the routeMap by doing regex
       * match and pass that as argument to the addRouteRecord
       */
      mfeParentRoute = Object.values(pathMap).find(record =>
        record.regex.test(route.path)
      )
      addRouteRecord(pathList, pathMap, nameMap, route, mfeParentRoute.parent)
    } else {
      addRouteRecord(pathList, pathMap, nameMap, route)
    }
  })

  // ensure wildcard routes are always at the end
  for (let i = 0, l = pathList.length; i < l; i++) {
    if (pathList[i] === '*') {
      pathList.push(pathList.splice(i, 1)[0])
      l--
      i--
    }
  }

  if (process.env.NODE_ENV === 'development') {
    // warn if routes do not include leading slashes
    const found = pathList
      // check for missing leading slash
      .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/')

    if (found.length > 0) {
      const pathNames = found.map(path => `- ${path}`).join('\n')
      warn(
        false,
        `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`
      )
    }
  }

  return {
    pathList,
    pathMap,
    nameMap
  }
}

function addRouteRecord (
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>,
  route: RouteConfig,
  parent?: RouteRecord,
  matchAs?: string
) {
  const { path, name } = route
  if (process.env.NODE_ENV !== 'production') {
    assert(path != null, `"path" is required in a route configuration.`)
    assert(
      typeof route.component !== 'string',
      `route config "component" for path: ${String(
        path || name
      )} cannot be a ` + `string id. Use an actual component instead.`
    )
  }

  const pathToRegexpOptions: PathToRegexpOptions =
      route.pathToRegexpOptions || {}
  const normalizedPath = normalizePath(
    path,
    parent,
    pathToRegexpOptions.strict
  )

  if (typeof route.caseSensitive === 'boolean') {
    pathToRegexpOptions.sensitive = route.caseSensitive
  }

  const record: RouteRecord = {
    path: normalizedPath,
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
    components: route.components || { default: route.component },
    mfes: route.mfes || { default: route.mfe },
    instances: {},
    name,
    parent,
    matchAs,
    redirect: route.redirect,
    beforeEnter: route.beforeEnter,
    meta: route.meta || {},
    mferedirect: (route && route.mferedirect) || undefined,
    props:
        route.props == null
          ? {}
          : route.components
            ? route.props
            : { default: route.props }
  }

  if (route.children) {
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    if (process.env.NODE_ENV !== 'production') {
      if (
        route.name &&
          !route.redirect &&
          route.children.some(child => /^\/?$/.test(child.path))
      ) {
        warn(
          false,
          `Named Route '${route.name}' has a default child route. ` +
              `When navigating to this named route (:to="{name: '${route.name}'"), ` +
              `the default child route will not be rendered. Remove the name from ` +
              `this route and use the name of the default child route for named ` +
              `links instead.`
        )
      }
    }
    route.children.forEach(child => {
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs)
    })
  }

  /**
     * for the case when mfe's children are added in async manner, the matched path
     * construction starts from mfe root path already preset thus that needs to be removed
     * before its children are added.
     */

  if (record.mfes && checkMFEProperties(record.mfes)) {
    const mfeIndexInPathlist = pathList.findIndex(path => {
      return path === record.path
    })
    const mfeTrailingPathIndexInPathlist = pathList.findIndex(path => {
      return path === record.path + '/'
    })
    if (
      mfeIndexInPathlist > -1 &&
        mfeTrailingPathIndexInPathlist > -1 &&
        mfeTrailingPathIndexInPathlist > mfeIndexInPathlist
    ) {
      // record.parent = undefined
      record.mferedirect = pathMap[pathList[mfeIndexInPathlist]].mferedirect
      delete pathMap[pathList[mfeIndexInPathlist]]
      pathList.splice(mfeIndexInPathlist, 1)
    }
  }

  if (!pathMap[record.path]) {
    pathList.push(record.path)
    /**
       * For the routes that aren't present and we are adding those,
       * remove the actual route that is present in the pathlist and push that one to the last
       * This is to be done becuase route matching will match the earlier one and not the one we are adding here.
       */
    // const extraRouteAlreadyInPathMap = Object.values(pathMap).find(path =>
    //   path.regex.test(record.path)
    // )
    // if (extraRouteAlreadyInPathMap) {
    //   const extraRouteAlreadyInPathMapIndex = pathList.findIndex(path => {
    //     return path === extraRouteAlreadyInPathMap.path
    //   })
    //   pathList.splice(extraRouteAlreadyInPathMapIndex, 1)
    //   pathList.push(extraRouteAlreadyInPathMap.path)
    // }
    pathMap[record.path] = record
  }

  if (route.alias !== undefined) {
    const aliases = Array.isArray(route.alias) ? route.alias : [route.alias]
    for (let i = 0; i < aliases.length; ++i) {
      const alias = aliases[i]
      if (process.env.NODE_ENV !== 'production' && alias === path) {
        warn(
          false,
          `Found an alias with the same value as the path: "${path}". You have to remove that alias. It will be ignored in development.`
        )
        // skip in dev to make it work
        continue
      }

      const aliasRoute = {
        path: alias,
        children: route.children
      }
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || '/' // matchAs
      )
    }
  }

  if (name) {
    if (!nameMap[name]) {
      nameMap[name] = record
    } else if (process.env.NODE_ENV !== 'production' && !matchAs) {
      warn(
        false,
        `Duplicate named routes definition: ` +
            `{ name: "${name}", path: "${record.path}" }`
      )
    }
  }
}

function compileRouteRegex (
  path: string,
  pathToRegexpOptions: PathToRegexpOptions
): RouteRegExp {
  const regex = Regexp(path, [], pathToRegexpOptions)
  if (process.env.NODE_ENV !== 'production') {
    const keys: any = Object.create(null)
    regex.keys.forEach(key => {
      warn(
        !keys[key.name],
        `Duplicate param keys in route with path: "${path}"`
      )
      keys[key.name] = true
    })
  }
  return regex
}

function normalizePath (
  path: string,
  parent?: RouteRecord,
  strict?: boolean
): string {
  if (!strict) path = path.replace(/\/$/, '')
  if (path[0] === '/') return path
  if (parent == null) return path
  return cleanPath(`${parent.path}/${path}`)
}
