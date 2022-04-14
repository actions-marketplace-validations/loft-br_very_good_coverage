const core = require('@actions/core');
const minimatch = require('minimatch');
const parse = require('lcov-parse');
const fs = require('fs');

function run() {
  const lcovPath = core.getInput('path');
  const minCoverage = core.getInput('min_coverage');
  const excluded = core.getInput('exclude');
  const changed = core.getInput('changed_files');
  const excludedFiles = excluded.split(' ');
  const changedFiles = changed.split(' ');

  if (!canParse(lcovPath)) {
    return;
  }

  parse(lcovPath, (err, data) => {
    if (typeof data === 'undefined') {
      core.setFailed('parsing error!');
      return;
    }

    const linesMissingCoverage = [];

    let totalFinds = 0;
    let totalHits = 0;
    data.forEach((element) => {
      if (shouldCalculateCoverageForFile(element['file'], changedFiles, excludedFiles)) {
        totalFinds += element['lines']['found'];
        totalHits += element['lines']['hit'];

        for (const lineDetails of element['lines']['details']) {
          const hits = lineDetails['hit'];

          if (hits === 0) {
            const fileName = element['file'];
            const lineNumber = lineDetails['line'];
            linesMissingCoverage[fileName] =
              linesMissingCoverage[fileName] || [];
            linesMissingCoverage[fileName].push(lineNumber);
          }
        }
      }
    });
    const coverage = (totalHits / totalFinds) * 100;
    const isValidBuild = coverage >= minCoverage;
    if (!isValidBuild) {
      const linesMissingCoverageByFile = Object.entries(
        linesMissingCoverage
      ).map(([file, lines]) => {
        return `${file}: ${lines.join(', ')}`;
      });

      core.setFailed(
        `${coverage} is less than min_coverage ${minCoverage}\n\n` +
          'Lines not covered:\n' +
          linesMissingCoverageByFile.map((line) => `  ${line}`).join('\n')
      );
    }
  });
}

function shouldCalculateCoverageForFile(fileName, changedFiles, excludedFiles) {
  for (let i = 0; i < excludedFiles.length; i++) {
    const isExcluded = minimatch(fileName, excludedFiles[i]);
    if (isExcluded) {
      core.debug(`Excluding ${fileName} from coverage`);
      return false;
    }
  }
  if (changedFiles !== null) {
    for (let j = 0; j < changedFiles.length; j++) {
      const isChanged = minimatch(fileName, changedFiles[j]);
      if (isChanged) {
        return true;
      }
      return false;
    }
  } else {
    return true;
  }
}

function canParse(path) {
  if (fs.existsSync(path) && fs.readFileSync(path).length === 0) {
    core.setFailed('lcov is empty!');
    return false;
  }

  return true;
}

run();
