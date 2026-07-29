export type PluginContext = {
  name: string;
  version: string;
};

export type ParityPlugin = {
  name: string;
  version: string;
  register: (ctx: PluginContext) => void | Promise<void>;
};

const registry = new Map<string, ParityPlugin>();

export function registerPlugin(plugin: ParityPlugin) {
  registry.set(plugin.name, plugin);
  return plugin.register({ name: plugin.name, version: plugin.version });
}

export function listPlugins() {
  return [...registry.values()].map((p) => ({ name: p.name, version: p.version }));
}

/** Example built-in plugin — demonstrates the extension point. */
registerPlugin({
  name: 'parity-core-metrics',
  version: '0.1.0',
  register() {
    // Hook point for custom exporters (Datadog, OTel, etc.).
  },
});
