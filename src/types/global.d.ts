// Permet d'importer des fichiers CSS dans TypeScript
declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}
