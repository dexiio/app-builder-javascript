const JavascriptBuilder = require('./builders/JavascriptBuilder');

const PROGRAM = 'component.js';

class AppComponentBuilder {

    constructor(sourceFolder, component) {
        this._component = component;
        this._sourceFolder = sourceFolder;
    }

    getLanguage() {
        if (this._component.specification &&
            this._component.specification.source &&
            this._component.specification.source.language) {
            return this._component.specification.source.language.toLowerCase();
        }

        return 'javascript';
    }

    getEntryPoint() {
        var entryPoint;
        if (this._component.specification &&
            this._component.specification.source &&
            this._component.specification.source.value) {
            entryPoint = this._component.specification.source.value;
        }

        if (!entryPoint) {
            throw new Error('No source file specified for component: ' + this._component.name);
        }

        return this._sourceFolder + '/' + entryPoint;
    }

    /**
     * Builds the given component and places the resulting asset into the target folder using the name "component.js".
     *
     * @param {string} target The path to place the assets into.
     */
    async build(target) {
        var language = this.getLanguage();

        if (['js','javascript'].indexOf(language) === -1) {
            throw new Error('Unsupported language: ' + language + ' for component: ' + this._component.name);
        }

        var entryPoint = this.getEntryPoint();

        var assets = [];

        const programTarget = target + '/' + PROGRAM;

        var jsBuilder = new JavascriptBuilder(AppComponentBuilder.isBrowserBased(this._component), entryPoint, programTarget, this._component);

        await jsBuilder.build(this._component.name);

        assets.push(programTarget);

        return assets;
    }

    static isBrowserBased(component) {
        switch(component.type) {
            case 'field-type':
                return true;
        }

        return false;
    }

    static needsBuilding(component) {
        switch(component.type) {
            case 'pipe-action':
            case 'field-type':
            case 'browser-action':
                return true;
        }

        return false;
    }
}

module.exports = AppComponentBuilder;