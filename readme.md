# H-Eye agent

Note: (To try the application without installing EYE reasoner, you can use the Docker version below)

![](hes-client.png?raw=true)

* TODO: Introduction
* In the meantime: [examples](./workspace)

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

The [workspace](./workspace) folder contains [examples](./workspace) on what kind of things can be declared.

To see the results do:

```
hes serve ./workspace
```

and point your browser to:

```
http://localhost:3000
```

Then 'follow the links'

Operations and dependency graph:
```
http://localhost:3000/dataspaces/operations
```


## Run with docker


### Start H-Eye on host port 3000:

```
docker run --name=h-eye -p 3000:3000 -v $PWD/workspace:/usr/src/app/workspace cristianvasquez/h-eye -t
```

Running your image with -d runs the container in detached mode, leaving the container running in the background.
The -p flag redirects a public port to a private port inside the container.
The -v flag mounts a directory to a directory inside the container.

If you need to go inside the container you can use the exec command:

## Enter the container

```
docker exec -it h-eye /bin/bash
```


### Stop the docker container

```
docker rm -f h-eye
```

## Test if it's up

```
curl -i localhost:3000
```

### Build your own image

```
docker build -t YOUR_USERNAME/h-eye .
```

(to build a clean image from scratch use the --no-cache option)