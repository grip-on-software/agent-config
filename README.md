# Web-based data gathering agent configuration

Web service to provide access to status information, configuration and 
verification of a data gathering agent.

## Requirements

- NodeJS 6+
- npm 3+
- GROS data-gathering agent

In addition, install the dependencies of this package using `npm install .` 
This also installs the front-end dependencies. If you do not plan to use the 
development modes, for example because you are installing this in production, 
then you can run `npm install --production .` instead.

## Configuration

Copy the file `lib/config.json` to `config.json` and adjust environmental 
options in that file. You can also provide the settings via environment 
variables when running the `npm run` command. The recognized configuration 
options and related environment variables are:

- `listen_address` (`LISTEN_ADDR`): The bind IP address to listen to. This 
  should usually be a local address such as `127.0.0.1` or the bind-any address 
  `0.0.0.0` to listen to all remote connections.
- `listen_port` (`LISTEN_PORT`): The port to listen to.
- `ssh_host` (`SSH_HOST`): The hostname of the controller API to connect to in 
  order to check for version updates of the agent.
- `agent_host` (`AGENT_HOST`): The hostname of the agent related to this 
  configuration web UI. This is where the scraper API is running. This can be 
  a local hostname,
  service hostname of another container running in a docker-compose instance,
  or a remote hostname. Note that the configuration web UI only writes files to 
  filesystem paths, which must be shared with the agent; it does not use the 
  hostname to share any configuration.
- `agent_port` (`AGENT_PORT`): The port of the agent where the scraper API is 
  running.
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
  of the web UI, when the viewer can see what happens with collected data.

## Building

A Jenkins Pipeline-based build definition is provided to generate and tag 
a versioned Docker image. This allows one to bundle the image with a GROS data 
gathering agent image, using a `docker-compose.yml` file to start them with 
shared volumes. An example Compose file is shown below.

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
