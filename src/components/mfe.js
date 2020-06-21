import { warn } from '../util/warn'

const MFEBooter = {
  name: 'mfe-booter',
  props: {
    mfe: {},
    depth: {},
    path_to_redirect_after_boot: null,
    mfemouthpath: ''
  },
  render (h) {
    console.log('Booting mfe: ', this.mfe)

    this.$nextTick(() => {
      this.mountmfe()
    })

    // if (this.mfe && this.mfe.mfevm) {
    //   const el = this.mfe.mfevm.$el
    //   const temphost = document.querySelector('#temphost')
    //   temphost.innerHTML = ''
    //   temphost.appendChild(el)
    // }

    return h('div', { attrs: { 'mfe-name': this.mfe && this.mfe.name }})
  },
  watch: {
    mfe: {
      handler: function (newvalue, oldvalue) {
        warn(false, `Running watcher for mfe ${newvalue.name}`)
        if (oldvalue && oldvalue.name && oldvalue.name !== newvalue.name) {
          try {
            this.destroymfe(oldvalue)
          } catch (err) {
            warn(false, 'Tried to destroy vm but got error')
          }
        }
      },
      immediate: true
    }
  },
  destroyed () {
    warn(false, `Destroying mfe ${this.mfe.name}`)
    this.destroymfe(this.mfe)
  },
  methods: {
    mountmfe () {
      if (this.mfe && !this.mfe.mfevm) {
        let shadowroot = this.$el.shadowRoot
        if (!shadowroot) {
          shadowroot = this.$el.attachShadow({ mode: 'open' })
        }
        shadowroot.innerHTML = ''
        const shodowhost = document.createElement('div')
        shadowroot.appendChild(shodowhost)
        // let mfemouthpath = ""
        // if (
        //   this.mfemouthpath &&
        //   this.$route.path.match(this.mfemouthpath) !== null
        // ) {
        //   mfemouthpath = this.$route.path
        // }
        this.mfe
          .boot(shodowhost, {
            mountpoint: shadowroot,
            router: this.$router,
            depth: this.depth,
            mfemouthpath: this.mfemouthpath
              ? this.mfemouthpath
              : this.$route.path
          })
          .then(() => {
            if (this.path_to_redirect_after_boot) {
              this.$router.push({ path: this.path_to_redirect_after_boot })
            }
            this.$emit('bootfinished')
          })
      }
    },
    destroymfe (mfe) {
      if (mfe) {
        mfe.mfevm.$destroy()
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
      default: false
    },
    shadowStyles: {
      type: String
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
        depth += parentIterator.mfedepth
      }
      parentIterator = parentIterator.$parent
    }
    // get matched routes which have mfes  - checking for default here as named outlets needs more work
    const mfeRoutesMatched = route.matched.filter(matchroute => {
      return matchroute.mfes.default !== undefined
    })
    const matched = mfeRoutesMatched[depth]
    const name = props.name
    let vnode = h()
    // let vnode = h('div', { attrs: { 'mfe-router-outlet': name }}, 'No mfe was matched!')

    if (matched && matched.mfes) {
      // const name = Object.keys(matched.mfes)[0]
      const mfe = matched && matched.mfes[name]

      if (name && mfe && !mfe.mfevm) {
        const subroutes = mfe.routes
        parent.$router.addRoutes([
          {
            name: route.name,
            path: route.path,
            mfe: mfe,
            children: subroutes
          }
        ])
      }
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
              path_to_redirect_after_boot: route.redirectedFrom,
              mfemouthpath: mfeRoutesMatched[depth]
                ? mfeRoutesMatched[depth]['path']
                : ''
            }
          })
        ]
      )
    }
    return vnode
  }
}
