type TablesConfig = {
  withLibrary?: boolean;
  outputType: "library" | "abstract" | "edit";
};

export class ProjectInfo {
  sources: Record<string, string> = {};
  entryFile: string;
  name: string;
  outputPath: string;
  testPath: string;
}
