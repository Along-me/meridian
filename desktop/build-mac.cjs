if(process.platform!=='darwin')throw new Error('Mac 测试包需要在 macOS 上构建，可运行仓库的 Mac unsigned test 工作流。');
require('./make-icons.cjs');require('./prepare.cjs');
const {build,Platform,Arch}=require('electron-builder');
const flag=process.argv.find(arg=>arg.startsWith('--arch='));
const requested=flag?[flag.slice(7)]:['arm64','x64'];
if(requested.some(arch=>!['arm64','x64'].includes(arch)))throw new Error('Unsupported Mac architecture');
build({targets:Platform.MAC.createTarget(['dmg','zip'],...requested.map(arch=>Arch[arch])),publish:'never',config:{electronDist:'',directories:{output:'release/mac-test'}}}).catch(error=>{console.error(error);process.exitCode=1});
