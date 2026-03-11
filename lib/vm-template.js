const crypto = require('crypto');

function randomName(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_';
  const all = chars + '0123456789';
  let result = chars[Math.floor(Math.random() * chars.length)];
  for (let i = 1; i < len; i++) {
    result += all[Math.floor(Math.random() * all.length)];
  }
  return result;
}

function randomHexName() {
  return '_' + crypto.randomBytes(8).toString('hex');
}

function shuffleOpcodes() {
  const base = [
    'LC','LN','LB','GL','SL','GG','SG','GT','ST',
    'AD','SU','MU','DI','MO','PO','CC','UN','NO','LE',
    'EQ','LT','LEQ','JM','JF','JT','CA','RE','CL','NT',
    'SLI','FP','FL','IP','IL','MV','PP','DU','MC','VA','FD'
  ];
  const mapping = {};
  const used = new Set();
  for (const op of base) {
    let val;
    do {
      val = Math.floor(Math.random() * 200) + 10;
    } while (used.has(val));
    used.add(val);
    mapping[op] = val;
  }
  return mapping;
}

function encodeConstant(val) {
  if (val === null || val === undefined) {
    return { t: 0 };
  }
  if (typeof val === 'number') {
    return { t: 1, v: val };
  }
  if (typeof val === 'string') {
    const encoded = [];
    const key = Math.floor(Math.random() * 200) + 50;
    for (let i = 0; i < val.length; i++) {
      encoded.push(val.charCodeAt(i) ^ ((i % 13 + 1) * 7 + key) & 0xFF);
    }
    return { t: 2, v: encoded, k: key };
  }
  if (typeof val === 'boolean') {
    return { t: 3, v: val ? 1 : 0 };
  }
  return { t: 0 };
}

function packBytecode(bytecodeData, opMapping) {
  const originalToShuffled = {
    1: opMapping.LC, 2: opMapping.LN, 3: opMapping.LB,
    4: opMapping.GL, 5: opMapping.SL, 6: opMapping.GG,
    7: opMapping.SG, 8: opMapping.GT, 9: opMapping.ST,
    16: opMapping.AD, 17: opMapping.SU, 18: opMapping.MU,
    19: opMapping.DI, 20: opMapping.MO, 21: opMapping.PO,
    22: opMapping.CC, 23: opMapping.UN, 24: opMapping.NO,
    25: opMapping.LE, 32: opMapping.EQ, 33: opMapping.LT,
    34: opMapping.LEQ, 48: opMapping.JM, 49: opMapping.JF,
    50: opMapping.JT, 64: opMapping.CA, 65: opMapping.RE,
    66: opMapping.CL, 67: opMapping.NT, 68: opMapping.SLI,
    80: opMapping.FP, 81: opMapping.FL, 82: opMapping.IP,
    83: opMapping.IL, 84: opMapping.MV, 85: opMapping.PP,
    86: opMapping.DU, 87: opMapping.MC, 88: opMapping.VA,
    89: opMapping.FD
  };

  function remapInstruction(ins) {
    const newIns = [...ins];
    if (originalToShuffled[newIns[0]] !== undefined) {
      newIns[0] = originalToShuffled[newIns[0]];
    }
    return newIns;
  }

  function processProto(proto) {
    return {
      constants: proto.constants.map(c => encodeConstant(c)),
      instructions: proto.instructions.map(ins => remapInstruction(ins)),
      protos: (proto.protos || []).map(p => processProto(p)),
      params: proto.params || 0,
      hasVarargs: proto.hasVarargs || false
    };
  }

  return processProto(bytecodeData);
}

function generateVM(bytecodeData) {
  const opMapping = shuffleOpcodes();
  const packed = packBytecode(bytecodeData, opMapping);

  const n = {
    OP: randomHexName(),
    HS: randomHexName(),
    dB: randomHexName(),
    dec: randomHexName(),
    raw: randomHexName(),
    data: randomHexName(),
    cVM: randomHexName(),
    env: randomHexName(),
    stk: randomHexName(),
    top: randomHexName(),
    pc: randomHexName(),
    loc: randomHexName(),
    cst: randomHexName(),
    ins: randomHexName(),
    pro: randomHexName(),
    psh: randomHexName(),
    pp: randomHexName(),
    pk: randomHexName(),
    dsc: randomHexName(),
    rin: randomHexName(),
    cns: randomHexName(),
    exe: randomHexName(),
    tmp: randomHexName(),
    tmp2: randomHexName(),
    tmp3: randomHexName(),
    tmp4: randomHexName(),
    tmp5: randomHexName(),
    tmp6: randomHexName(),
    tmp7: randomHexName(),
    fn: randomHexName(),
    ar: randomHexName(),
    res: randomHexName(),
    nE: randomHexName(),
    fL: randomHexName(),
    ag: randomHexName(),
    ob: randomHexName(),
    mt: randomHexName(),
    sl: randomHexName(),
    st: randomHexName(),
    li: randomHexName(),
    sr: randomHexName(),
    nR: randomHexName(),
    nA: randomHexName(),
    vl: randomHexName(),
    ci: randomHexName(),
    rt: randomHexName()
  };

  const packedStr = JSON.stringify(packed);
  const encBytes = [];
  const xorKey = Math.floor(Math.random() * 200) + 30;
  const xorKey2 = Math.floor(Math.random() * 150) + 20;
  for (let i = 0; i < packedStr.length; i++) {
    encBytes.push(
      packedStr.charCodeAt(i) ^ ((i % 11 + 1) * xorKey & 0xFF) ^ (xorKey2 & 0xFF)
    );
  }
  const b64 = Buffer.from(encBytes).toString('base64');

  const junkVars = [];
  for (let i = 0; i < 15; i++) {
    const jn = randomHexName();
    const jv = Math.random() > 0.5
      ? `"${crypto.randomBytes(16).toString('hex')}"`
      : `${Math.floor(Math.random() * 99999)}`;
    junkVars.push(`local ${jn}=${jv}`);
  }
  const junkBlock = junkVars.join('\n');

  const junkFuncs = [];
  for (let i = 0; i < 5; i++) {
    const fn = randomHexName();
    const pn = randomHexName();
    junkFuncs.push(`local function ${fn}(${pn})return ${pn} end`);
  }
  const junkFuncBlock = junkFuncs.join('\n');

  return `${junkBlock}
${junkFuncBlock}
local ${n.OP}={[${opMapping.LC}]=1,[${opMapping.LN}]=2,[${opMapping.LB}]=3,[${opMapping.GL}]=4,[${opMapping.SL}]=5,[${opMapping.GG}]=6,[${opMapping.SG}]=7,[${opMapping.GT}]=8,[${opMapping.ST}]=9,[${opMapping.AD}]=10,[${opMapping.SU}]=11,[${opMapping.MU}]=12,[${opMapping.DI}]=13,[${opMapping.MO}]=14,[${opMapping.PO}]=15,[${opMapping.CC}]=16,[${opMapping.UN}]=17,[${opMapping.NO}]=18,[${opMapping.LE}]=19,[${opMapping.EQ}]=20,[${opMapping.LT}]=21,[${opMapping.LEQ}]=22,[${opMapping.JM}]=23,[${opMapping.JF}]=24,[${opMapping.JT}]=25,[${opMapping.CA}]=26,[${opMapping.RE}]=27,[${opMapping.CL}]=28,[${opMapping.NT}]=29,[${opMapping.PP}]=30,[${opMapping.DU}]=31,[${opMapping.MC}]=32,[${opMapping.FP}]=33,[${opMapping.FL}]=34,[${opMapping.FD}]=35,[${opMapping.VA}]=36}
local ${n.HS}=game:GetService("HttpService")
local function ${n.dB}(${n.tmp})
local ${n.tmp2}="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local ${n.tmp3}={}
for ${n.ci}=1,#${n.tmp2} do ${n.tmp3}[string.sub(${n.tmp2},${n.ci},${n.ci})]=${n.ci}-1 end
${n.tmp}=${n.tmp}:gsub("[^%w%+%/%=]","")
local ${n.tmp4}=0
local ${n.tmp5}=0
local ${n.tmp6}={}
for ${n.ci}=1,#${n.tmp} do
local ${n.tmp7}=string.sub(${n.tmp},${n.ci},${n.ci})
if ${n.tmp7}~="=" then
${n.tmp4}=${n.tmp4}*64+${n.tmp3}[${n.tmp7}]
${n.tmp5}=${n.tmp5}+6
if ${n.tmp5}>=8 then
${n.tmp5}=${n.tmp5}-8
${n.tmp6}[#${n.tmp6}+1]=string.char(math.floor(${n.tmp4}/2^${n.tmp5})%256)
end end end
return table.concat(${n.tmp6})
end
local function ${n.dec}(${n.tmp})
local ${n.tmp6}={}
for ${n.ci}=1,#${n.tmp} do
local ${n.tmp4}=string.byte(${n.tmp},${n.ci})
${n.tmp6}[#${n.tmp6}+1]=string.char(bit32.bxor(bit32.bxor(${n.tmp4},bit32.band((${n.ci}%11+1)*${xorKey},255)),bit32.band(${xorKey2},255)))
end
return table.concat(${n.tmp6})
end
local function ${n.dsc}(${n.tmp})
if ${n.tmp}.t==0 then return nil
elseif ${n.tmp}.t==1 then return ${n.tmp}.v
elseif ${n.tmp}.t==2 then
local ${n.tmp6}={}
local ${n.tmp7}=${n.tmp}.k
for ${n.ci}=1,#${n.tmp}.v do
${n.tmp6}[#${n.tmp6}+1]=string.char(bit32.bxor(${n.tmp}.v[${n.ci}],bit32.band((${n.ci}%13)*7+${n.tmp7},255)))
end
return table.concat(${n.tmp6})
elseif ${n.tmp}.t==3 then return ${n.tmp}.v==1
end
end
local ${n.raw}=${n.dec}(${n.dB}("${b64}"))
local ${n.data}=${n.HS}:JSONDecode(${n.raw})
local function ${n.rt}(${n.tmp})
local ${n.tmp6}={}
for ${n.ci}=1,#${n.tmp}.constants do
${n.tmp6}[${n.ci}]=${n.dsc}(${n.tmp}.constants[${n.ci}])
end
${n.tmp}.constants=${n.tmp6}
if ${n.tmp}.protos then
for ${n.ci}=1,#${n.tmp}.protos do
${n.rt}(${n.tmp}.protos[${n.ci}])
end
end
end
${n.rt}(${n.data})
local function ${n.cVM}(${n.pro},${n.env})
local ${n.stk}={}
local ${n.top}=0
local ${n.pc}=1
local ${n.loc}={}
local ${n.cst}=${n.pro}.constants
local ${n.ins}=${n.pro}.instructions
local ${n.tmp}=${n.pro}.protos or{}
local function ${n.psh}(${n.vl})${n.top}=${n.top}+1 ${n.stk}[${n.top}]=${n.vl} end
local function ${n.pp}()local ${n.vl}=${n.stk}[${n.top}]${n.stk}[${n.top}]=nil ${n.top}=${n.top}-1 return ${n.vl} end
local function ${n.pk}()return ${n.stk}[${n.top}] end
while ${n.pc}<=#${n.ins} do
local ${n.rin}=${n.ins}[${n.pc}]
local ${n.exe}=${n.OP}[${n.rin}[1]]
${n.pc}=${n.pc}+1
if ${n.exe}==1 then ${n.psh}(${n.cst}[${n.rin}[2]+1])
elseif ${n.exe}==2 then ${n.psh}(nil)
elseif ${n.exe}==3 then ${n.psh}(${n.rin}[2]==1)
elseif ${n.exe}==4 then ${n.psh}(${n.loc}[${n.rin}[2]])
elseif ${n.exe}==5 then ${n.loc}[${n.rin}[2]]=${n.pp}()
elseif ${n.exe}==6 then ${n.psh}(${n.env}[${n.cst}[${n.rin}[2]+1]])
elseif ${n.exe}==7 then ${n.env}[${n.cst}[${n.rin}[2]+1]]=${n.pp}()
elseif ${n.exe}==8 then local ${n.tmp2}=${n.pp}()local ${n.tmp3}=${n.pp}()${n.psh}(${n.tmp3}[${n.tmp2}])
elseif ${n.exe}==9 then local ${n.vl}=${n.pp}()local ${n.tmp2}=${n.pp}()local ${n.tmp3}=${n.pp}()${n.tmp3}[${n.tmp2}]=${n.vl}
elseif ${n.exe}==10 then local ${n.tmp2}=${n.pp}()local ${n.tmp3}=${n.pp}()${n.psh}(${n.tmp3}+${n.tmp2})
elseif ${n.exe}==11 then local ${n.tmp2}=${n.pp}()local ${n.tmp3}=${n.pp}()${n.psh}(${n.tmp3}-${n.tmp2})
elseif ${n.exe}==12 then local ${n.tmp2}=${n.pp}()local ${n.tmp3}=${n.pp}()${n.psh}(${n.tmp3}*${n.tmp2})
elseif ${n.exe}==13 then local ${n.tmp2}=${n.pp}()local ${n.tmp3}=${n.pp}()${n.psh}(${n.tmp3}/${n.tmp2})
elseif ${n.exe}==14 then local ${n.tmp2}=${n.pp}()local ${n.tmp3}=${n.pp}()${n.psh}(${n.tmp3}%${n.tmp2})
elseif ${n.exe}==15 then local ${n.tmp2}=${n.pp}()local ${n.tmp3}=${n.pp}()${n.psh}(${n.tmp3}^${n.tmp2})
elseif ${n.exe}==16 then local ${n.tmp2}=${n.pp}()local ${n.tmp3}=${n.pp}()${n.psh}(${n.tmp3}..${n.tmp2})
elseif ${n.exe}==17 then ${n.psh}(-${n.pp}())
elseif ${n.exe}==18 then ${n.psh}(not ${n.pp}())
elseif ${n.exe}==19 then ${n.psh}(#${n.pp}())
elseif ${n.exe}==20 then local ${n.tmp2}=${n.pp}()local ${n.tmp3}=${n.pp}()${n.psh}(${n.tmp3}==${n.tmp2})
elseif ${n.exe}==21 then local ${n.tmp2}=${n.pp}()local ${n.tmp3}=${n.pp}()${n.psh}(${n.tmp3}<${n.tmp2})
elseif ${n.exe}==22 then local ${n.tmp2}=${n.pp}()local ${n.tmp3}=${n.pp}()${n.psh}(${n.tmp3}<=${n.tmp2})
elseif ${n.exe}==23 then ${n.pc}=${n.rin}[2]+1
elseif ${n.exe}==24 then local ${n.vl}=${n.pp}()if not ${n.vl} then ${n.pc}=${n.rin}[2]+1 end
elseif ${n.exe}==25 then local ${n.vl}=${n.pp}()if ${n.vl} then ${n.pc}=${n.rin}[2]+1 end
elseif ${n.exe}==26 then local ${n.nA}=${n.rin}[2]local ${n.nR}=${n.rin}[3]local ${n.ar}={}for ${n.ci}=${n.nA},1,-1 do ${n.ar}[${n.ci}]=${n.pp}()end local ${n.fn}=${n.pp}()local ${n.res}={${n.fn}(unpack(${n.ar}))}if ${n.nR}>0 then for ${n.ci}=1,${n.nR} do ${n.psh}(${n.res}[${n.ci}])end else for ${n.ci}=1,#${n.res} do ${n.psh}(${n.res}[${n.ci}])end end
elseif ${n.exe}==27 then local ${n.tmp2}=${n.rin}[2]local ${n.vl}={}for ${n.ci}=${n.tmp2},1,-1 do ${n.vl}[${n.ci}]=${n.pp}()end return unpack(${n.vl})
elseif ${n.exe}==28 then local ${n.tmp2}=${n.tmp}[${n.rin}[2]+1]${n.psh}(function(...)local ${n.nE}=setmetatable({},{__index=${n.env},__newindex=${n.env}})local ${n.fL}={}local ${n.ag}={...}for ${n.ci}=1,${n.tmp2}.params do ${n.fL}[${n.ci}-1]=${n.ag}[${n.ci}] end return ${n.cVM}({constants=${n.tmp2}.constants,instructions=${n.tmp2}.instructions,protos=${n.tmp2}.protos,params=${n.tmp2}.params,hasVarargs=${n.tmp2}.hasVarargs},${n.nE})end)
elseif ${n.exe}==29 then ${n.psh}({})
elseif ${n.exe}==30 then ${n.pp}()
elseif ${n.exe}==31 then ${n.psh}(${n.pk}())
elseif ${n.exe}==32 then local ${n.mt}=${n.cst}[${n.rin}[2]+1]local ${n.nA}=${n.rin}[3]local ${n.ar}={}for ${n.ci}=${n.nA},1,-1 do ${n.ar}[${n.ci}]=${n.pp}()end local ${n.ob}=${n.pp}()local ${n.fn}=${n.ob}[${n.mt}]local ${n.res}={${n.fn}(${n.ob},unpack(${n.ar}))}${n.psh}(${n.res}[1])
elseif ${n.exe}==33 then local ${n.sl}=${n.rin}[2]local ${n.st}=${n.pp}()local ${n.li}=${n.pp}()local ${n.sr}=${n.pp}()${n.loc}[${n.sl}]=${n.sr}-${n.st} ${n.loc}[${n.sl}+1]=${n.li} ${n.loc}[${n.sl}+2]=${n.st}
elseif ${n.exe}==34 then local ${n.sl}=${n.rin}[2]local ${n.st}=${n.loc}[${n.sl}+2]${n.loc}[${n.sl}]=${n.loc}[${n.sl}]+${n.st} if(${n.st}>0 and ${n.loc}[${n.sl}]<=${n.loc}[${n.sl}+1])or(${n.st}<0 and ${n.loc}[${n.sl}]>=${n.loc}[${n.sl}+1])then ${n.pc}=${n.rin}[3]+1 end
elseif ${n.exe}==35 then local ${n.tmp2}=${n.pp}()local ${n.tmp3}=${n.pp}()${n.psh}(math.floor(${n.tmp3}/${n.tmp2}))
elseif ${n.exe}==36 then
end end end
local ${n.env}=setmetatable({},{__index=getfenv and getfenv()or _ENV})
for ${n.tmp2},${n.tmp3} in pairs({print=print,warn=warn,error=error,type=type,typeof=typeof,tostring=tostring,tonumber=tonumber,pairs=pairs,ipairs=ipairs,next=next,select=select,unpack=unpack or table.unpack,pcall=pcall,xpcall=xpcall,rawget=rawget,rawset=rawset,rawequal=rawequal,rawlen=rawlen,setmetatable=setmetatable,getmetatable=getmetatable,newproxy=newproxy,require=require,coroutine=coroutine,string=string,table=table,math=math,bit32=bit32,os=os,task=task,game=game,workspace=workspace,script=script,wait=wait,delay=delay,spawn=spawn,tick=tick,time=time,Instance=Instance,Vector3=Vector3,Vector2=Vector2,CFrame=CFrame,Color3=Color3,BrickColor=BrickColor,UDim=UDim,UDim2=UDim2,Enum=Enum,Ray=Ray,Region3=Region3,Rect=Rect,TweenInfo=TweenInfo,NumberSequence=NumberSequence,ColorSequence=ColorSequence,NumberRange=NumberRange,NumberSequenceKeypoint=NumberSequenceKeypoint,ColorSequenceKeypoint=ColorSequenceKeypoint,PhysicalProperties=PhysicalProperties,Random=Random,debug=debug,utf8=utf8,buffer=buffer,SharedTable=SharedTable,hookmetamethod=hookmetamethod,hookfunction=hookfunction,getrawmetatable=getrawmetatable,setrawmetatable=setrawmetatable,getnamecallmethod=getnamecallmethod,checkcaller=checkcaller,getcallingscript=getcallingscript,iscclosure=iscclosure,islclosure=islclosure,newcclosure=newcclosure,clonefunction=clonefunction,getinfo=getinfo or debug and debug.getinfo,Drawing=Drawing,crypt=crypt,syn=syn,fluxus=fluxus,getgenv=getgenv,getrenv=getrenv,getgc=getgc,getsenv=getsenv,getinstances=getinstances,getnilinstances=getnilinstances,fireclickdetector=fireclickdetector,firetouchinterest=firetouchinterest,fireproximityprompt=fireproximityprompt,isnetworkowner=isnetworkowner,sethiddenproperty=sethiddenproperty,gethiddenproperty=gethiddenproperty,setsimulationradius=setsimulationradius})do ${n.env}[${n.tmp2}]=${n.tmp3} end
${n.cVM}(${n.data},${n.env})`;
}

module.exports = { generateVM };
