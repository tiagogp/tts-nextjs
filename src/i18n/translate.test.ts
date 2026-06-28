import { describe, expect, it } from "vitest";
import { translate } from "./translate";

describe("translate", () => {
  it("only translates Portuguese UI copy", () => {
    expect(translate("pt", "Settings")).toBe("Configurações");
    expect(translate("es", "Settings")).toBe("Settings");
  });
});
