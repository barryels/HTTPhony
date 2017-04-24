var name = 'HTTPhony';
var argv = require('minimist')(process.argv.slice(2));
var http = require('http');
var protocolHandler = http;
var server,
	options = getOptions(argv);


function getOptions(argv) {
	console.log(name + '.getOptions() >', argv);
	return {
		PORT: argv.port || '8000',
		FIXTURES_PATH: argv.fixtures_path || '/src/fixtures'
	}
}

function delayResponseEnd(res, time) {
	// console.log('delayResponseEnd()');
	if (time) {
		setTimeout(function () {
			res.end();
		}, time);
	} else {
		res.end();
	}
}


function handleRequest(req, res) {
	console.info(name + '.handleRequest()', req.method, ':', req.url);

	var options = {
		hostname: req.hostname,
		path: req.url,
		protocol: 'http:',
		method: req.method,
		headers: req.headers,
		data: []
	};

	if (req.url === '/favicon.ico') {
		res.writeHead(200, { 'Content-Type': 'image/x-icon' });
		res.end();
	} else {
		if (req.method === 'OPTIONS') {
			console.log('handleRequest() > return CORS headers');
			res.writeHead(200, getCORSHeaders());
			delayResponseEnd(res, 0);
		} else {
			req.on('data', function (chunk) {
				options.data.push(chunk);
			}).on('end', function () {
				options.data = Buffer.concat(options.data).toString();
				doFakeRequest(options, req, res);
			});
		}
	}
}


function buildHeadersForCURL(headers) {
	var propName;
	var result = '';

	for (propName in headers) {
		if (propName === 'authorization') {
			result += '--header "' + propName + ': ' + headers[propName] + '" ';
		}
	}

	return result;
}


function doCURLRequest(options, res, success) {
	var exec = require('child_process').exec;
	var child;
	var headers = buildHeadersForCURL(options.headers);
	var command = 'curl ' + options.method + ' ' + headers + ' ' + options.protocol + '//' + options.hostname + options.path;

	// console.log('-----');
	// console.log(command);
	// console.dir(options.data);
	// console.log('-----');

	child = exec(command, function (error, stdout, stderr) {
		// console.log('stdout: ' + stdout);
		// console.log('stderr: ' + stderr);

		if (error !== null) {
			console.log('exec error: ' + error);
		}

		success(res, stdout);
	});

}


function getFakeResponseFilePathForRequest(request) {
	var path = require('path');
	var fakeResponseFilePath = path.resolve(__dirname) + '/..' + options.FIXTURES_PATH + request.url + '/response.http';

	return fakeResponseFilePath;
}


function doesFakeResponseExistForRequest(request) {
	var fs = require('fs');

	return fs.existsSync(getFakeResponseFilePathForRequest(request));
}


function getFakeResponseFileContentForRequest(request) {
	var fs = require('fs');
	var fakeResponseFileContents = fs.readFileSync(getFakeResponseFilePathForRequest(request), 'utf8');

	return fakeResponseFileContents;
}


function getCORSHeaders() {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Origin, X-Requested-With, Content-Type, Accept, Authorization'
	};
}


function getHeadersFromFakeResponseFileContent(fileContent) {
	var result = getCORSHeaders();
	var fileContentAsLines = fileContent.split(/\r?\n/);
	var fileContentLinesCount = fileContentAsLines.length;
	var i = 0,
		start = 0,
		end = 0,
		propName;

	for (i = 0; i < fileContentLinesCount; i++) {
		if (fileContentAsLines[i] === '# headers #') {
			start = i + 1;
		}
		if (fileContentAsLines[i] === '# body #') {
			end = i - 1;
			break;
		}
	}

	fileContentAsLines = fileContentAsLines.slice(start, end);

	for (i = 0; i < fileContentAsLines.length; i++) {
		var item = fileContentAsLines[i];
		var propName = item.split(': ')[0];
		var propValue = item.split(': ')[1];
		result[propName] = propValue;
	}

	return result;
}


function getBodyFromFakeResponseFileContent(fileContent) {
	var result = '';
	var fileContentAsLines = fileContent.split('# body #')[1].split(/\r?\n/);
	result = fileContentAsLines.slice(1, fileContentAsLines.length - 1).join('\r\n');

	return result;
}


function doFakeRequest(options, req, res) {
	var fakeResponseFileContent = getFakeResponseFileContentForRequest(req);

	res.writeHead(200, getHeadersFromFakeResponseFileContent(fakeResponseFileContent));
	res.write(getBodyFromFakeResponseFileContent(fakeResponseFileContent));

	delayResponseEnd(res, 0);
}


function init() {
	server = protocolHandler.createServer(handleRequest);

	server.listen(options.PORT);

	console.log(name + '.init()', '> Listening @', protocolHandler.globalAgent.protocol + '//localhost:' + options.PORT);
}


init();
