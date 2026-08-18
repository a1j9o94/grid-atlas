// `hidden` is a global HTML attribute and browsers honour it on SVG elements,
// but React's SVGAttributes omit it. The map's #map element ships hidden until
// the engine finishes inking, so the attribute has to exist in JSX.
import "react";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- interface merging must repeat the original's type parameter
  interface SVGAttributes<T> {
    hidden?: boolean | undefined;
  }
}
