import ENS from 'ethjs-ens';

export default {
  resolve (nameOrNode, opts = {}) {
    const isName = nameOrNode.includes('.')

    // Stupid hack for ethjs-ens
    if (!opts.provider.sendAsync) {
      opts.provider.sendAsync = opts.provider.send
    }

    const ens = new ENS(opts)
    if (isName) {
      return ens.lookup(nameOrNode)
    }

    return ens.resolveAddressForNode(nameOrNode)
  }
};
