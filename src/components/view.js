import { warn } from '../util/warn'
import { extend } from '../util/misc'

export default {
  name: 'RouterView',
  functional: true,
  props: {
    name: {
      type: String,
      default: 'default'
    }
  },
  render (_, { props, children, parent, data }) {
    // used by devtools to display a router-view badge
    data.routerView = true

    // directly use parent context's createElement() function
    // so that components rendered by router-view can resolve named slots
    const h = parent.$createElement
    const name = props.name
    const route = parent.$route
    const cache = parent._routerViewCache || (parent._routerViewCache = {})

    // determine current view depth, also check to see if the tree
    // has been toggled inactive but kept-alive.
    let depth = 0
    let inactive = false
    let parentItr = parent
    while (parentItr) {
      if (parentItr._isMfe) {
        // get depth only from the actual mfe and not its children
        // 1 is added here because while adding child routes of mfe in create-route-map.js:36 a link to parent is
        // provided to construct the proper matched array. This here creates one base entry with undefined path
        // will have to debug even more to fix this..
        depth = parentItr.mfedepth
        break
      }
      parentItr = parentItr.$parent
    }
    // if (depth > 1) {
    //   depth++
    // }
    // if (depth > 1) {
    //   depth += depth - 1
    // }
    while (parent && parent._routerRoot !== parent) {
      const vnodeData = parent.$vnode ? parent.$vnode.data : {}
      if (vnodeData.routerView) {
        depth++
      }
      if (vnodeData.keepAlive && parent._directInactive && parent._inactive) {
        inactive = true
      }
      parent = parent.$parent
    }
    data.routerViewDepth = depth

    // render previous view if the tree is inactive and kept-alive
    if (inactive) {
      const cachedData = cache[name]
      const cachedComponent = cachedData && cachedData.component
      if (cachedComponent) {
        // #2301
        // pass props
        if (cachedData.configProps) {
          fillPropsinData(
            cachedComponent,
            data,
            cachedData.route,
            cachedData.configProps
          )
        }
        return h(cachedComponent, data, children)
      } else {
        // render previous empty view
        return h()
      }
    }
    // const matchedRoutesExcludingMFEs = route.matched.filter(route => {
    //   return (
    //     route.mfes &&
    //     !checkMFEProperties(route.mfes)
    //   )
    // })
    /**
     * This is being done to filter out the unique matched routes
     * Non unique matched routes are because when addRouteRecord is called
     * in create-route-match.js:40 and then parent's path is normalized in the
     * function then parent chain c->b->a gets wrong and extra entry is being
     * created when formatMatch is called for the route.matched to be populated.
     * Get this redone when spending mroe time.
     */
    // const matchedUniqueRoutes = route.matched.filter(
    //   (set => record => !set.has(record.path) && set.add(record.path))(
    //     new Set()
    //   )
    // )
    const matched = route.matched[depth]
    const component = matched && matched.components[name]

    // render empty node if no matched route or no config component
    if (!matched || !component) {
      cache[name] = null
      return h()
    }

    // cache component
    cache[name] = { component }

    // attach instance registration hook
    // this will be called in the instance's injected lifecycle hooks
    data.registerRouteInstance = (vm, val) => {
      // val could be undefined for unregistration
      const current = matched.instances[name]
      if ((val && current !== vm) || (!val && current === vm)) {
        matched.instances[name] = val
      }
    }

    // also register instance in prepatch hook
    // in case the same component instance is reused across different routes
    ;(data.hook || (data.hook = {})).prepatch = (_, vnode) => {
      matched.instances[name] = vnode.componentInstance
    }

    // register instance in init hook
    // in case kept-alive component be actived when routes changed
    data.hook.init = vnode => {
      if (
        vnode.data.keepAlive &&
        vnode.componentInstance &&
        vnode.componentInstance !== matched.instances[name]
      ) {
        matched.instances[name] = vnode.componentInstance
      }
    }

    const configProps = matched.props && matched.props[name]
    // save route and configProps in cachce
    if (configProps) {
      extend(cache[name], {
        route,
        configProps
      })
      fillPropsinData(component, data, route, configProps)
    }

    return h(component, data, children)
  }
}

function fillPropsinData (component, data, route, configProps) {
  // resolve props
  let propsToPass = (data.props = resolveProps(route, configProps))
  if (propsToPass) {
    // clone to prevent mutation
    propsToPass = data.props = extend({}, propsToPass)
    // pass non-declared props as attrs
    const attrs = (data.attrs = data.attrs || {})
    for (const key in propsToPass) {
      if (!component.props || !(key in component.props)) {
        attrs[key] = propsToPass[key]
        delete propsToPass[key]
      }
    }
  }
}

function resolveProps (route, config) {
  switch (typeof config) {
    case 'undefined':
      return
    case 'object':
      return config
    case 'function':
      return config(route)
    case 'boolean':
      return config ? route.params : undefined
    default:
      if (process.env.NODE_ENV !== 'production') {
        warn(
          false,
          `props in "${route.path}" is a ${typeof config}, ` +
            `expecting an object, function or boolean.`
        )
      }
  }
}
