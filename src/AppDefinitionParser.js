const FS = require('fs');
const YAML = require('yamljs');

class AppDefinitionParser {

    constructor(file) {
        this._file = file;

        const contents = FS.readFileSync(file).toString();

        this._yaml = YAML.parse(contents);
    }


    getComponents() {
        return this._yaml.components;
    }
}

module.exports = AppDefinitionParser;
