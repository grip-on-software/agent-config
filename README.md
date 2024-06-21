# Web-based data gathering agent configuration

[![npm](https://img.shields.io/npm/v/@gros/agent-config.svg)](https://www.npmjs.com/package/@gros/agent-config)
[![Build 
status](https://github.com/grip-on-software/agent-config/actions/workflows/agent-config-tests.yml/badge.svg)](https://github.com/grip-on-software/agent-config/actions/workflows/agent-config-tests.yml)
[![Coverage 
Status](https://coveralls.io/repos/github/grip-on-software/agent-config/badge.svg?branch=master)](https://coveralls.io/github/grip-on-software/agent-config?branch=master)
[![Quality Gate 
Status](https://sonarcloud.io/api/project_badges/measure?project=grip-on-software_agent-config&metric=alert_status)](https://sonarcloud.io/project/overview?id=grip-on-software_agent-config)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.11115708.svg)](https://doi.org/10.5281/zenodo.11115708)

Web service to provide access to status information, configuration and 
verification of a data gathering agent used in the Grip on Software (GROS) 
research project.

## Requirements

The agent configuration service is tested with Node.js 20+ and npm 10+.

A GROS [data-gathering](https://github.com/grip-on-software/data-gathering) 
agent should be deployed in concert with the configuration service in order to 
make use of the created configuration; see the [Building](#building) for an 
example Docker Compose setup. The agent also communicates with the controller 
server daemon that is available in that repository.

For a standalone usage, install the dependencies of this package by running 
`npm install .` This also installs the front-end dependencies. If you do not 
plan to use the development modes, for example because you are installing this 
in production, then you can run `npm install --production .` instead.

## Configuration

Copy the file `lib/config.json` to `config.json` and adjust environmental 
options in that file. You can also provide the settings via environment 
variables when running the `npm run` command. The recognized configuration 
options and related environment variables (uppercase variants) are:

- `listen_address` (`LISTEN_ADDR`): The bind IP address to listen to. This 
  should usually be a local address such as `127.0.0.1` or the bind-any address 
  `0.0.0.0` to listen to all remote connections.
- `listen_port` (`LISTEN_PORT`): The port to listen to.
- `listen_host` (`LISTEN_HOST`): The hostname of the configuration web UI that
  users must use to connect to the interface. If provided, then other domain
  name and port combinations result in a Forbidden error, counteracting DNS 
  rebinding attacks.
- `ssh_host` (`SSH_HOST`): The hostname of the controller API to connect to in 
  order to check for version updates of the agent.
- `ssh_https_port` (`SSH_HTTPS_PORT`): Port of the controller API to connect to
  in order to check for version updates of the agent.
- `ssh_https_cert` (`SSH_HTTPS_CERT`): Certificate of the controller API to
  validate during the connection to check for version updates.
- `update_timeout` (`UPDATE_TIMEOUT`): Milliseconds to wait for the version
  update check response before considering the connection to be unavailable.
- `agent_host` (`AGENT_HOST`): The hostname of the agent related to this 
  configuration web UI. This is where the scraper API is running. This can be 
  a local hostname,
  service hostname of another container running in a docker-compose instance,
  or a remote hostname. Note that the configuration web UI only writes files to 
  filesystem paths, which must be shared with the agent; it does not use the 
  hostname to share any configuration.
- `agent_port` (`AGENT_PORT`): The port of the agent where the scraper API is 
  running.
- `scrape_timeout` (`SCRAPE_TIMEOUT`): Milliseconds to wait for the scraper API
  before considering the connection to be unavailable.
- `export_path` (`EXPORT_PATH`): The (relative) path in which dropins and 
  exported data from the agent are stored, including data source information 
  and scrape status. If this path is not the current working directory (empty 
  string), then the export data is accessible via the web UI.
- `config_path` (`CONFIG_PATH`): The (relative) path in which agent settings 
  and credentials are stored. If this path is not the current working directory 
  (empty string), then the raw configuration is accessible via the web UI.
- `key_path` (`IDENTITY_PATH`): The (relative) path in which SSH keys are 
  stored.
- `visualization_url` (`VISUALIZATION_URL`): URL to link to from the index page 
  of the web UI, where the viewer can see what happens with collected data.

Additionally, the following options can be adjusted in order to display 
different help snippets (example placeholders, information links) in the agent 
form editor:

- `jira_url`: The base URL to a JIRA instance where the JIRA boards are found.
- `bigboat_placeholder`: An example base URL of a BigBoat instance.
- `quality_time_placeholder`: An example base URL of a Quality-time instance.
- `sonar_placeholder`: An example base URL of a SonarQube instance.
- `version_control_placeholder`: An example domain name of a version control 
  system, preferably a simple one.
- `version_control_port_sample`: An example domain name of a version control 
  system including a port number.
- `jenkins_placeholder`: An example domain name of a Jenkins CI build server.

## Building

A Jenkins Pipeline-based build definition is provided to generate and tag 
a versioned Docker image. This allows one to bundle the image with a GROS data 
gathering agent image, using a `docker-compose.yml` file to start them with 
shared volumes. An example Docker Compose file is shown below.

```compose
agent:
  image: gros-data-gathering:latest
  volumes:
    - /path/to/export:/home/agent/export
    - /path/to/config:/home/agent/config
    - /path/to/.ssh:/home/agent/.ssh
www:
  image: gros-agent-config:latest
  volumes:
    - /path/to/export:/home/agent/export
    - /path/to/config:/home/agent/config
    - /path/to/.ssh:/home/agent/.ssh
  environment:
    - EXPORT_PATH=/home/agent/export
    - CONFIG_PATH=/home/agent/config
    - IDENTITY_PATH=/home/agent/.ssh
```

Make sure you that reference the correct Docker registry and that all paths are 
similar. The environment can also be configured in a file added during the 
build as described in the [Configuration](#configuration) section.

## Running

The web server can be started in three environment modes: development, dev-sync 
(BrowserSync and nodemon autoreload support) and production. The three modes 
can be started using respectively `npm run dev`, `npm run watch` or `npm start` 
(the latter is started automatically when using Docker). Use the autoreload 
support by starting `npm run watch` in a separate terminal, then you can 
develop and instantly see the changes take effect.

## Development and testing

Run the unit tests using `npm test`. You may want to override the configuration 
options, especially if you if you have a `config.json` file with options 
different from the default, or if you do not have privileges to open certain 
ports. You can adjust these options by setting environment variables:

```
LISTEN_ADDR= SSH_HTTPS_PORT=8443 SSH_HTTPS_CERT=cert/server.crt \
SSH_HOST=localhost AGENT_PORT=7070 AGENT_HOST=localhost UPDATE_TIMEOUT=100 \
SCRAPE_TIMEOUT=100 LISTEN_HOST= npm test
```

[GitHub Actions](https://github.com/grip-on-software/agent-config/actions) is 
used to run the unit tests and report on coverage on commits and pull requests. 
This includes quality gate scans tracked by 
[SonarCloud](https://sonarcloud.io/project/overview?id=grip-on-software_agent-config) 
and [Coveralls](https://coveralls.io/github/grip-on-software/agent-config) for 
coverage history.

We publish releases to [npm](https://www.npmjs.com/package/@gros/agent-config). 
The release files are also published on 
[GitHub](https://github.com/grip-on-software/agent-config/releases) and from 
there are archived on [Zenodo](https://doi.org/10.5281/zenodo.11115707). 
Noteworthy changes are added to the [changelog](CHANGELOG.md).

## License

The agent configuration service is licensed under the Apache 2.0 License.
