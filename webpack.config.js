// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    entry: {
        index: "./src/index.ts",
        sw: "./src/sw.ts",
    },
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "dist"),
    },
    mode: "production",
    optimization:{
        minimizer: [
            new TerserPlugin({
                parallel: true,
                terserOptions: {
                    compress: false, // compress==true breaks owl
                    mangle: true
                },
            }),
        ]
    },
    devtool: "source-map",
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        compress: true,
        port: 9000,
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
};
