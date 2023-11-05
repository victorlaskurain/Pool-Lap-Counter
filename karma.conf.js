module.exports = function (config) {
    config.set({
        basePath: '',
        frameworks: ["jasmine", "karma-typescript"],
        files: [
            "test/**/*.ts",
            {
                pattern: "test/assets/**",
                watched: false,
                included: false,
                served: true,
            },
        ],
        preprocessors: {
            "**/*.ts": "karma-typescript", // *.tsx for React Jsx
        },
        reporters: ["progress", "karma-typescript"],
    });
};
