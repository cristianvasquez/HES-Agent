# H-Eye agent

## Running it as command line

First of all, you need to **install the EYE reasoner** ([Windows](http://eulersharp.sourceforge.net/README.Windows) – [OS X](http://eulersharp.sourceforge.net/README.MacOSX) – [Linux](http://eulersharp.sourceforge.net/README.Linux)).

(make sure that you can run this using '/bin/sh eye', or set the EYE_PATH environment variable)

Then, install the server package as follows:

``` bash
$ [sudo] npm -g install h-eye
```

### Running

```
hes serve <directory>
```

More options with

```
hes --help
```

### Examples

The (workspace)[./workspace] folder contains examples on what kind of things can be declared.

To see the results do:

```
hes serve ./workspace
```

and point your browser to:

```
http://localhost:3000
```

Then 'follow the links'

## Run with docker

### Build hydra-eye server

```
docker build -t cvasquez/hydra-eye .
```

(to build a clean image from scratch use the --no-cache option)

### Start the docker image


Start HydraEye on host port 3000:

```
docker run --name=hydra-eye -p 3000:3000 -v $PWD/workspace:/usr/src/app/workspace cvasquez/hydra-eye
```

Running your image with -d runs the container in detached mode, leaving the container running in the background. 
The -p flag redirects a public port to a private port inside the container.
The -v flag mounts a directory to a directory inside the container.

If you need to go inside the container you can use the exec command:

```
# Enter the container
docker exec -it hydra-eye /bin/bash
```

### Stop the docker container

```
docker rm -f hydra-eye
```

## Test if it's up

```
curl -i localhost:3000
```
