# javascript computer vision https livereload + browserify

run `npm install` to install express

then `npm run create_keys` to create the `.key` and `.cert` file

You can just slam the enter key a bunch through all the prompts.  _If you want the green icon, make sure to enter `localhost` when asked for the
common name._

```bash
$ npm run create_keys

> https_express_example@1.0.0 create_keys /Users/bill/https_express/https_express_example
> openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx.key -out nginx.crt

Generating a 2048 bit RSA private key
......................................................+++
.............................................................................+++
writing new private key to 'nginx.key'
-----
You are about to be asked to enter information that will be incorporated
into your certificate request.
What you are about to enter is what is called a Distinguished Name or a DN.
There are quite a few fields but you can leave some blank
For some fields there will be a default value,
If you enter '.', the field will be left blank.
-----
Country Name (2 letter code) [AU]:
State or Province Name (full name) [Some-State]:
Locality Name (eg, city) []:
Organization Name (eg, company) [Internet Widgits Pty Ltd]:
Organizational Unit Name (eg, section) []:
Common Name (e.g. server FQDN or YOUR name) []:localhost
Email Address []:
```

_In OSX_ If you then type `open nginx.crt` and click "Always Trust", then everything should work without the warning prompts.

Finally run the server `npm start; npm run livereload`.
