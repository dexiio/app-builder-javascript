const FS = require('fs');

const AppDefinitionParser = require('./src/AppDefinitionParser');
const AppComponentBuilder = require('./src/AppComponentBuilder');


const SOURCE_FOLDER = process.env.SOURCE_FOLDER || '/var/workspace/source';
const TARGET_FOLDER = process.env.TARGET_FOLDER || '/var/workspace/target';

var DEXI_YAML_PATH = SOURCE_FOLDER + '/dexi.yml';

if (!FS.existsSync(DEXI_YAML_PATH)) {
    DEXI_YAML_PATH = SOURCE_FOLDER + '/dexi.yaml';

    if (!FS.existsSync(DEXI_YAML_PATH)) {
        console.error("No dexi.yaml file found in source folder! (%s)", DEXI_YAML_PATH);
        process.exit(1);
    }
}

async function doProcess() {
    const parser = new AppDefinitionParser(DEXI_YAML_PATH);

    const components = await parser.getComponents();

    return Promise.all(components.map(async function(component) {
        if (!AppComponentBuilder.needsBuilding(component)) {
            return null;
        }

        const componentId = component.id;

        const componentBuilder = new AppComponentBuilder(SOURCE_FOLDER, component);

        return componentBuilder.build(TARGET_FOLDER + '/' + componentId);
    }));
}

doProcess().then(function() {
    console.log("Build succeeded!");
    process.exit(0);
}).catch(function(err) {
    console.error("Build failed: \n", err ? err.stack : 'Unknown error');
    process.exit(1);
});
