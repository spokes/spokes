var EventEmitter = require('events').EventEmitter;
var net = require('net');
var repl = require("repl");
var fs = require('fs');
var spawn = require('child_process').spawn;

var config = {
  path: __dirname,
  restart_timeout: 10000,
	lock_file: __dirname+'/spokes.pid'
};

var spokes = {};

start_spokes();

function start_spokes(){
  console.log('');
  console.log('         |             ');
  console.log('     \\   |   /         ');
  console.log('       \\ | /     Spokes');
  console.log('   ----- O -----       ');
  console.log('       / | \\           ');
  console.log('     /   |   \\         ');
  console.log('         |             ');
  console.log('');
  var files = fs.readdirSync(config.path);
  files.forEach(function(dir_name){
    if(dir_name === 'log') return;
    if(dir_name === '.git') return;
    var stat = fs.statSync(dir_name);
    if(stat.isDirectory()) start_spoke(dir_name);
  });
};

function start_spoke(app_name){
  var path = _path_to_spoke(app_name);
  if(!path) return false;

  if(!spokes[app_name]){
    spokes[app_name] = {
      app_name:app_name,
      running: true,
      restart_enabled: true
    };
  }
  var start_msg = 'Attempting to start '+app_name+' at '+path+'\n';
  log({ app_name:'monitor', text: start_msg});

  spokes[app_name].process = spawn('node',[path]);

  spokes[app_name].process.stdout.on('data', function (data) {
    var msg = { app_name: app_name, text:data};
    log(msg);
  });  
  spokes[app_name].process.stderr.on('data', function (data) {
    var msg = { app_name: app_name, text:data};
    log(msg);
  });
  spokes[app_name].process.on('exit', function (code) {
    var msg = { app_name: app_name, text:'exited with code ' + code+'\n'};
    spokes[app_name].running = false;
    log(msg);
    if(_should_restart(app_name)) start_spoke(app_name);
  });
}

function stop_spokes(){
  for(app_name in spokes){
    stop_spoke(app_name);
  }
}

function stop_spoke(app_name){
  if(!spokes[app_name] || !spokes[app_name].process){
    return false;
  }
  var msg = {app_name:'monitor',text:'Attempting to stop '+app_name+'\n'};
  print_to_screen(msg);
  log(msg);
  spokes[app_name].process.kill();
}

function restart_spoke(app_name){
  var spoke = spokes[app_name];
  spoke.restart_enabled = true;
  stop_spoke(app_name);
}

function list_spokes(){
  print_to_screen({text:'SPOKES CURRENTLY RUNNING'});
  for(app_name in spokes){
    if(spokes[app_name].running) print_to_screen({text:app_name});
  } 
}

function print_to_screen(msg){
  var text;
  if(typeof(msg) === 'string'){
    text = msg;
  }else{
    text = msg.text;
  }
  console.log(text);
}

function log(msg){
  var text = msg.app_name+': '+msg.text;
  print_to_screen(text);
  append_file(config.path+'/log/log.txt', text);
  append_file(config.path+'/log/'+msg.app_name+'.txt', text);    
}

function help(){
  print_to_screen({
		app_name:'monitor', 
		text:"commands:\n"+
			"list_spokes()\n"+
			"start_spokes()\n"+
			"stop_spokes()\n"+
			"start_spoke( app_name )\n"+
			"stop_spoke( app_name )\n"+
			"restart_spoke( app_name )\n"+
			"\n"+
			"globals:\n"+
			"config.path\n"+
			"config.restart_timeout\n"+
			"spokes\n"
	});
}

function append_file(path,text){
  var buffer = new Buffer(text,'ascii');
  fs.open( path, 'a', function(err,fd){
    fs.write(fd, buffer, 0, buffer.length, null, function(err, wrtitten){
      fs.close(fd);
    })
  });
}

function spoke_exists(app_name){
  if(_path_to_spoke(app_name)) return true;
  else return false;
}

function _path_to_spoke(app_name){
  var path_to_app = config.path+'/'+app_name+'/app.js';
  try{
      fs.statSync(path_to_app);
  } catch(err) {
    var warning = 'WARNING '+path_to_app+' does not exist'; 
    print_to_screen({app_name:'monitor',text:warning});
    log({app_name:'monitor',text:warning});
    return false;
  }
  return path_to_app;
}

function _should_restart(app_name){
  if(spokes[app_name].restart_enabled == false) return false;
  spokes[app_name].restart_enabled = false;
  return true;
  setTimeout(function(){
    spokes[app_name].restart_enabled = true;
  },config.restart_timeout);
  return true;
}
