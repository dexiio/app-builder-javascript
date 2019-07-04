const FS = require('fs');

const AppDefinitionParser = require('./src/AppDefinitionParser');
const AppComponentBuilder = require('./src/AppComponentBuilder');


const SOURCE_FOLDER = process.env.SOURCE_FOLDER || '/var/workspace/source';
const TARGET_FOLDER = process.env.TARGET_FOLDER || '/var/workspace/target';

var DEXI_YAML_PATH = SOURCE_FOLDER + '/dexi.yml';

if (!FS.existsSync(DEXI_YAML_PATH)) {
    console.error("No dexi.yml file found in source folder! (%s)", DEXI_YAML_PATH);
    process.exit(1);
}

async function doProcess() {
    const parser = new AppDefinitionParser(DEXI_YAML_PATH);

    const components = await parser.getComponents();

    return Promise.all(components.map(async function(component) {
        if (!AppComponentBuilder.needsBuilding(component)) {
            return null;
        }

        const componentName = component.name;

        const componentBuilder = new AppComponentBuilder(SOURCE_FOLDER, component);

        return componentBuilder.build(TARGET_FOLDER + '/' + componentName);
    }));
}

async function execute () {
    try {
        await doProcess();
        console.log("Build succeeded!");
        process.exit(0);
    } catch (err) {
        console.error("Build failed: \n", err ? err.message : 'Unknown error'); // The stack will simply point to AppComponentBuilder
        process.exit(1);
    }

}

execute();