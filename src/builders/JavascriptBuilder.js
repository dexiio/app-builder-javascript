const _ = require('lodash');
const FS = require('fs');
const Path = require('path');
const ChildProcess = require('child_process');
const Browserify = require('browserify');
const Stringify = require('stringify');
const NodeLessify = require('node-lessify');
const Linter = require('eslint').Linter;

const StringifyOptions = ['.html', '.xhtml', '.txt', '.hbs', '.xml'];
const NodeLessifyOptions = {textMode: true};

const LINT_OPTIONS = require('./.eslintrc');
const BROWSER_ACTION_LINT_OPTIONS = require('./.eslintrc.browser-action');
const PIPE_ACTION_LINT_OPTIONS = require('./.eslintrc.pipe-action');
const FIELD_TYPE_LINT_OPTIONS = require('./.eslintrc.field-type');

function iterateFolder(dir, callback, filter) {
    FS.readdirSync(dir).forEach(file => {
        const absPath = dir + '/' + file;

        if (filter && !filter(absPath, file)) {
            return;
        }

        if (FS.statSync(absPath).isDirectory()) {
            iterateFolder(absPath, callback);
        } else {
            callback(absPath, file);
        }
    });
}

function ignoreNodeModulesFilter(absPath, name) {
    return (name !== 'node_modules');
}

class JavascriptBuilder {

    constructor(buildForBrowser, entrypoint, target, component) {
        this._buildForBrowser = buildForBrowser;
        this._entrypoint = entrypoint;
        this._target = target;
        this._component = component;
    }

    maybeNpmInstall() {
        const baseDir = Path.dirname(this._entrypoint);
        const path = baseDir + '/package.json';

        if (!FS.existsSync(path)) {
            return
        }

        console.log('Running NPM for component source in %s', baseDir);

        ChildProcess.execSync('npm --quiet install', {
            cwd: baseDir,
            env: process.env,
            stdio: ['inherit', 'inherit', 'inherit']
        });

        console.log(' - NPM OK');
    }

    _lintAll() {
        let hadErrors = false;
        const baseDir = Path.dirname(this._entrypoint);

        if (this._buildForBrowser) {
            LINT_OPTIONS.env = 'browser';
        } else {
            LINT_OPTIONS.env = 'node';
        }

        console.log('Linting component source in: %s', baseDir);

        iterateFolder(baseDir, (filePath) => {
            if (!filePath.endsWith('.js')) {
                return;
            }

            const fileContents = FS.readFileSync(filePath).toString();
            const linter = new Linter();
            const messages = linter.verify(fileContents, this.getLintOptions(), filePath);

            messages.forEach(message => {
                if (message.fatal || message.severity > 1) {
                    hadErrors = true;
                    console.log('err', message.ruleId);
                    console.error("\t - Lint error in file %s:%s:%s ", filePath, message.line + 1, message.column + 1, message.message);
                } else {
                    console.log('warn', message.ruleId);
                    console.warn("\t - Lint warning in file %s:%s:%s ", filePath, message.line + 1, message.column + 1, message.message);
                }
            });
        }, ignoreNodeModulesFilter);

        if (!hadErrors) {
            console.log('Component source OK in: %s', baseDir);
            return;
        }

        throw new Error('Component failed linting verification');
    }

    async _compile(componentName) {
        console.log('Compiling component: %s', this._entrypoint);

        const baseDir = Path.dirname(this._entrypoint);

        var opts = {
            basedir: baseDir,
            externalRequireName: 'components["' + componentName + '"]'
        };

        if (!this._buildForBrowser) {
            opts.node = true;
        } else {
            //Even in browser mode we'll get the builtins from the existing browserify bundle
            opts.builtins = false;
        }

        opts.standalone = 'DexiModule'; // Allows us to access the browserify context externally using the name "DexiModule"

        const browserify = Browserify(opts);

        browserify.transform(Stringify(StringifyOptions));
        browserify.transform(NodeLessify, NodeLessifyOptions);

        browserify.add(this._entrypoint, {
            expose: 'component'
        });

        var me = this;
        var targetFolder = Path.dirname(me._target);

        if (!FS.existsSync(targetFolder)) {
            FS.mkdirSync(targetFolder);
        }

        if (FS.existsSync(me._target)) {
            FS.unlinkSync(me._target);
        }

        return new Promise(function(resolve, reject) {
            browserify.bundle(function(err, buffer) {
                if (err) {
                    reject(err);
                    return;
                }

                console.log('Writing compiled component to file: %s', me._target);
                FS.writeFileSync(me._target, buffer);
                resolve();
            });
        });
    }

    async build(componentName) {
        if (!FS.existsSync(this._entrypoint)) {
            throw new Error('Source file not found: ' + this._entrypoint);
        }

        this._lintAll();

        this.maybeNpmInstall();

        return this._compile(componentName);
    }

    getLintOptions () {
        switch (this._component.type) {
            case 'browser-action':
                return _.merge(LINT_OPTIONS, BROWSER_ACTION_LINT_OPTIONS);

            case 'pipe-action':
                return _.merge(LINT_OPTIONS, PIPE_ACTION_LINT_OPTIONS);

            case 'field-type':
                return _.merge(LINT_OPTIONS, FIELD_TYPE_LINT_OPTIONS);

            default:
                return LINT_OPTIONS;
        }
    }
}

module.exports = JavascriptBuilder;