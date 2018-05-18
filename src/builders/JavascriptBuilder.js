const FS = require('fs');
const Path = require('path');
const ChildProcess = require('child_process');
const LintStream = require('jslint').LintStream;
const Browserify = require('browserify');
const Stringify = require('stringify');


const IgnoreLintErrorList = [
    (err) => (err.code === 'expected_a_before_b' && err.a === 'use strict'),
    (err) => (err.code === 'bad_property_a' && err.a.startsWith('$'))
];

function ignoreError(err) {
    for(var i = 0; i < IgnoreLintErrorList.length; i++) {
        if (IgnoreLintErrorList[i](err)) {
            return true;
        }
    }

    return false;
}

const StringifyOptions = ['.html', '.xhtml', '.txt', '.hbs', '.xml'];

function iterateFolder(dir, callback, filter) {
    var files = FS.readdirSync(dir);
    files.forEach(function(file) {
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

    constructor(buildForBrowser, entrypoint, target) {
        this._buildForBrowser = buildForBrowser;
        this._entrypoint = entrypoint;
        this._target = target;
    }

    maybeNpmInstall() {
        var baseDir = Path.dirname(this._entrypoint);
        var path = baseDir + '/package.json';

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
        var hadErrors = false;
        const baseDir = Path.dirname(this._entrypoint);

        const opts = {
            edition: "latest",
            length: 100,
            strict: false,
            sloppy: true,
            browserify: true,
            es6: true,
            predef: [
                'module',
                't',
                'require'
            ]
        };

        if (this._buildForBrowser) {
            opts.predef.push('$');
        }

        const lint = new LintStream(opts);

        console.log('Linting component source in: %s', baseDir);

        lint.on('data', function(chunk) {

            if (chunk.linted.ok) {
                return;
            }

            chunk.linted.errors.forEach(function(err) {
                if (ignoreError(err)) {
                    return;
                }

                hadErrors = true;

                console.log('err', err.code);

                console.error("\t - Lint error in file %s:%s:%s ", chunk.file, err.line + 1, err.column + 1, err.message);
            });
        });

        iterateFolder(baseDir, function(filePath) {
            if (!filePath.endsWith('.js')) {
                return;
            }

            const fileContents = FS.readFileSync(filePath).toString();

            lint.write({
                file: filePath,
                body: fileContents
            });
        }, ignoreNodeModulesFilter);

        if (!hadErrors) {
            console.log('Component source OK in: %s', baseDir);
            return;
        }

        throw new Error('Component failed linting verification');
    }

    async _compile(componentId) {
        console.log('Compiling component: %s', this._entrypoint);

        const baseDir = Path.dirname(this._entrypoint);

        var opts = {
            basedir: baseDir,
            externalRequireName: 'components["' + componentId + '"]'
        };

        if (!this._buildForBrowser) {
            opts.node = true;
        } else {
            //Even in browser mode we'll get the builtins from the existing browserify bundle
            opts.builtins = false;
        }

        var browserify = Browserify(opts);

        browserify.transform(Stringify(StringifyOptions));

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

    async build(componentId) {
        if (!FS.existsSync(this._entrypoint)) {
            throw new Error('Source file not found: ' + this._entrypoint);
        }

        this._lintAll();

        this.maybeNpmInstall();

        return this._compile(componentId);
    }
}

module.exports = JavascriptBuilder;