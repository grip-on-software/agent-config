# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 
and we adhere to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2024-07-13

### Added

- Support for SonarQube source added.

### Changed

- Test on Node.js 20 and 22 on GitHub Actions, no longer base Docker image on 
  Node 16.
- Dependencies updated.

### Removed

- Support for Quality reporting source dropped.

### Security

- Limit accepted size of uploads to forms.

## [0.0.3] - 2024-05-05

### Added

- Initial release of version as used during the GROS research project. 
  Previously, versions were rolling releases based on Git commits.

[Unreleased]: 
https://github.com/grip-on-software/visualization-ui/compare/v1.0.0...HEAD
[1.0.0]:  
https://github.com/grip-on-software/agent-config/compare/v0.0.3...1.0.0
[0.0.3]: https://github.com/grip-on-software/agent-config/releases/tag/v0.0.3
