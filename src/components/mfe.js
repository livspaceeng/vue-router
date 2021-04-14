import { warn } from '../util/warn'

const MFEBooter = {
  name: 'mfe-booter',
  props: {
    mfe: {},
    depth: {},
    customKey: {
      type: Number
    },
    path_to_redirect_after_boot: null,
    mfemountpath: '',
    useShadowDom: {
      type: Boolean,
      default: true
    }
  },
  data () {
    return {
      bootedMFE: null,
      mfeChildRedirectPath: null
    }
  },
  render (h) {
    const mfeInfo =
      this.mfe.name +
      '\n' +
      this.depth +
      '\n' +
      this.mfemountpath +
      '\n' +
      this.path_to_redirect_after_boot +
      '\n' +
      this.customKey
    warn(
      false,
      'Booting mfe: ' + this.mfe && this.mfe.name + '\n\n MFE : ' + mfeInfo
    )
    this.$nextTick(() => {
      this.mountmfe()
    })

    return h('div', { attrs: { 'mfe-name': this.mfe && this.mfe.name }})
  },
  watch: {
    mfe: {
      handler: function (newvalue, oldvalue) {
        if (newvalue) {
          warn(false, `Running watcher for mfe ${newvalue.name}`)
        }
        if (
          oldvalue &&
          oldvalue.name &&
          newvalue &&
          oldvalue.name !== newvalue.name
        ) {
          this.destroymfe(oldvalue)
        }
      },
      immediate: true
    }
  },
  beforeDestroy () {
    try {
      warn(
        false,
        `Destroying mfe ${this.bootedMFE ? this.bootedMFE.name : this.mfe.name}`
      )
      this.destroymfe(this.bootedMFE ? this.bootedMFE : this.mfe)
    } catch (err) {
      warn(
        false,
        'Tried to destroy vm but got error - Error:',
        err || undefined
      )
    }
  },
  methods: {
    mountmfe () {
      if (this.mfe && !this.mfe.mfevm) {
        this.mfeChildRedirectPath = this.path_to_redirect_after_boot
        let shadowroot
        if (this.useShadowDom) {
          shadowroot = this.$el.shadowRoot
          if (!shadowroot) {
            shadowroot = this.$el.attachShadow({ mode: 'open' })
          }
        } else {
          shadowroot = this.$el
        }
        shadowroot.innerHTML = ''
        shadowroot.innerText = ''
        const shodowhost = document.createElement('div')
        shadowroot.appendChild(shodowhost)
        this.mfe
          .boot(shodowhost, {
            mountpoint: shadowroot,
            router: this.$router,
            store: this.$store,
            depth: this.depth,
            mfemountpath: this.mfemountpath
              ? this.mfemountpath
              : this.$route.path
          })
          .then(() => {
            this.bootedMFE = this.mfe
            if (this.mfeChildRedirectPath) {
              this.$router.push({
                path: this.mfeChildRedirectPath
              })
            }
            this.$emit('bootfinish')
          })
      }
    },
    destroymfe (mfe) {
      if (mfe && mfe.mfevm) {
        try {
          warn(false, `Destroying mfe ${mfe.name}`)
          mfe.mfevm.$destroy()
        } catch (err) {
          warn(false, 'Tried to destroy vm but got error')
        }
        mfe.mfevm = null
      }
    }
  }
}

export default {
  name: 'router-mfe',
  functional: true,
  props: {
    name: {
      type: String,
      default: 'default'
    },
    useShadowDom: {
      type: Boolean,
      default: true
    },
    shadowStyles: {
      type: String
    },
    customKey: {
      type: Number
    }
  },
  render (h, { props, children, parent, data }) {
    // used by devtools to display a router-view badge
    // data.routerView = true
    // const h = parent.$createElement
    data.routerView = true
    // parent.$vnode.data = data;
    const route = parent.$route

    let depth = 0

    // if (parent.mfedepth !== undefined) {
    //   depth += parent.mfedepth
    // }
    let parentIterator = parent
    while (parentIterator) {
      if (parentIterator._isMfe) {
        // depth += parentIterator.mfedepth
        depth = parentIterator.mfedepth
        break
      }
      parentIterator = parentIterator.$parent
    }
    while (parent && parent._routerRoot !== parent) {
      const vnodeData = parent.$vnode ? parent.$vnode.data : {}
      if (vnodeData.routerView) {
        depth++
      }
      parent = parent.$parent
    }
    // get matched routes which have mfes  - checking for default here as named outlets needs more work
    // const mfeRoutesMatched = route.matched.filter(matchroute => {
    //   return checkMFEProperties(matchroute.mfes)
    // })
    // const matchedUniqueRoutes = route.matched.filter(
    //   (set => record => !set.has(record.path) && set.add(record.path))(
    //     new Set()
    //   )
    // )
    const matched = route.matched[depth]
    const name = props.name
    let vnode = h()
    if (matched && matched.mfes) {
      let mfemountpath = matched ? matched['path'] : ''
      if (mfemountpath[mfemountpath.length - 1] === '/') {
        mfemountpath = mfemountpath.slice(0, -1)
      }

      const mfe = matched && matched.mfes[name]
      let mfeRoutesExist = true
      if (name && mfe && !mfe.mfevm) {
        mfeRoutesExist = false
        const subroutes = mfe.routes
        subroutes.forEach((route) => {
          if (route.redirect) {
            if (typeof route.redirect === 'string') {
              route.redirect = mfemountpath + route.redirect
            } else if (typeof route.redirect === 'object' && route.redirect.path) {
              route.redirect.path = mfemountpath + route.redirect.path
            }
          }
        })
        parent.$router.addRoutes([
          {
            name: matched.name,
            path: matched.path,
            mfes: matched.mfes,
            children: subroutes
          }
        ])
      }
      const pathToRedirectAfterBoot = mfeRoutesExist
        ? undefined
        : route.mferedirect
      /**
       * Clearing the mferedirect here as for subsequent route match the mferedirection should not happen
       */
      matched.mferedirect = undefined
      vnode = h(
        'div',
        {
          attrs: { 'mfe-router-outlet': name }
        },
        [
          h(MFEBooter, {
            props: {
              mfe,
              depth: depth + 1,
              customKey: props.customKey,
              useShadowDom: props.useShadowDom,
              path_to_redirect_after_boot: pathToRedirectAfterBoot,
              mfemountpath: mfemountpath
            }
          })
        ]
      )
    }
    return vnode
  }
}
