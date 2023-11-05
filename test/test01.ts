describe("A simple suite", () => {
    it("has a spec that passes", () => {
        expect(1).toEqual(1);
    });
    it("has a spec that fails", () => {
        expect(1).toEqual(2);
    });
});
