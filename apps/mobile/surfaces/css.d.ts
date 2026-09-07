/* The surfaces bundle typechecks the web components outside Next's own project, so the
   stylesheet declarations Next would supply are declared here instead. */

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';
