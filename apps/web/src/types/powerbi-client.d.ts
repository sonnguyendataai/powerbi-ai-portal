declare module "powerbi-client" {
  export const factories: {
    hpmFactory: unknown;
    wpmpFactory: unknown;
    routerFactory: unknown;
  };
  export namespace service {
    class Service {
      constructor(hpmFactory: unknown, wpmpFactory: unknown, routerFactory: unknown);
      embed(container: HTMLElement, config: object): void;
      reset(container: HTMLElement): void;
    }
  }
}
