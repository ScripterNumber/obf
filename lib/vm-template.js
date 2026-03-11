function generateVM(bytecodeData) {
  const jsonStr = JSON.stringify(bytecodeData);
  const bytes = [];
  for (let i = 0; i < jsonStr.length; i++) {
    const b = jsonStr.charCodeAt(i);
    const key = ((i % 7) + 1) * 13 + 37;
    bytes.push(b ^ key);
  }
  const encoded = Buffer.from(bytes).toString('base64');

  return `local OP={LC=1,LN=2,LB=3,GL=4,SL=5,GG=6,SG=7,GT=8,ST=9,AD=16,SU=17,MU=18,DI=19,MO=20,PO=21,CC=22,UN=23,NO=24,LE=25,EQ=32,LT=33,LEQ=34,JM=48,JF=49,JT=50,CA=64,RE=65,CL=66,NT=67,SLI=68,FP=80,FL=81,IP=82,IL=83,MV=84,PP=85,DU=86,MC=87,VA=88,FD=89}
local HttpService=game:GetService("HttpService")
local function decodeB64(s)local chars="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"local r={}for i=1,#chars do r[string.sub(chars,i,i)]=i-1 end s=s:gsub("[^%w%+%/%=]","")local buf=0 local bits=0 local out={}for i=1,#s do local c=string.sub(s,i,i)if c~="=" then buf=buf*64+r[c]bits=bits+6 if bits>=8 then bits=bits-8 out[#out+1]=string.char(math.floor(buf/2^bits)%256)end end end return table.concat(out)end
local function decrypt(s)local out={}for i=1,#s do local b=string.byte(s,i)local k=((i-1)%7+1)*13+37 out[#out+1]=string.char(bit32.bxor(b,k))end return table.concat(out)end
local raw=decrypt(decodeB64("${encoded}"))
local data=HttpService:JSONDecode(raw)
local function createVM(proto,env)local stack={}local top=0 local pc=1 local locals={}local consts=proto.constants local instrs=proto.instructions local protos=proto.protos or{}local function push(v)top=top+1 stack[top]=v end local function pop()local v=stack[top]stack[top]=nil top=top-1 return v end local function peek()return stack[top]end
while pc<=#instrs do local ins=instrs[pc]local op=ins[1]pc=pc+1
if op==OP.LC then push(consts[ins[2]+1])
elseif op==OP.LN then push(nil)
elseif op==OP.LB then push(ins[2]==1)
elseif op==OP.GL then push(locals[ins[2]])
elseif op==OP.SL then locals[ins[2]]=pop()
elseif op==OP.GG then push(env[consts[ins[2]+1]])
elseif op==OP.SG then env[consts[ins[2]+1]]=pop()
elseif op==OP.GT then local k=pop()local t=pop()push(t[k])
elseif op==OP.ST then local v=pop()local k=pop()local t=pop()t[k]=v
elseif op==OP.AD then local b=pop()local a=pop()push(a+b)
elseif op==OP.SU then local b=pop()local a=pop()push(a-b)
elseif op==OP.MU then local b=pop()local a=pop()push(a*b)
elseif op==OP.DI then local b=pop()local a=pop()push(a/b)
elseif op==OP.MO then local b=pop()local a=pop()push(a%b)
elseif op==OP.PO then local b=pop()local a=pop()push(a^b)
elseif op==OP.CC then local b=pop()local a=pop()push(a..b)
elseif op==OP.UN then push(-pop())
elseif op==OP.NO then push(not pop())
elseif op==OP.LE then push(#pop())
elseif op==OP.EQ then local b=pop()local a=pop()push(a==b)
elseif op==OP.LT then local b=pop()local a=pop()push(a<b)
elseif op==OP.LEQ then local b=pop()local a=pop()push(a<=b)
elseif op==OP.JM then pc=ins[2]+1
elseif op==OP.JF then local v=pop()if not v then pc=ins[2]+1 end
elseif op==OP.JT then local v=pop()if v then pc=ins[2]+1 end
elseif op==OP.CA then local nargs=ins[2]local nret=ins[3]local args={}for i=nargs,1,-1 do args[i]=pop()end local fn=pop()local results={fn(unpack(args))}if nret>0 then for i=1,nret do push(results[i])end else for i=1,#results do push(results[i])end end
elseif op==OP.RE then local n=ins[2]local vals={}for i=n,1,-1 do vals[i]=pop()end return unpack(vals)
elseif op==OP.CL then local p=protos[ins[2]+1]push(function(...)local newEnv=setmetatable({},{__index=env,__newindex=env})local fLocals={}local args={...}for i=1,p.params do fLocals[i-1]=args[i]end return createVM({constants=p.constants,instructions=p.instructions,protos=p.protos,params=p.params,hasVarargs=p.hasVarargs},newEnv)end)
elseif op==OP.NT then push({})
elseif op==OP.DU then push(peek())
elseif op==OP.PP then pop()
elseif op==OP.MC then local method=consts[ins[2]+1]local nargs=ins[3]local args={}for i=nargs,1,-1 do args[i]=pop()end local obj=pop()local fn=obj[method]local results={fn(obj,unpack(args))}push(results[1])
elseif op==OP.FP then local slot=ins[2]local step=pop()local limit=pop()local start=pop()locals[slot]=start-step locals[slot+1]=limit locals[slot+2]=step
elseif op==OP.FL then local slot=ins[2]local step=locals[slot+2]locals[slot]=locals[slot]+step if(step>0 and locals[slot]<=locals[slot+1])or(step<0 and locals[slot]>=locals[slot+1])then pc=ins[3]+1 end
elseif op==OP.FD then local b=pop()local a=pop()push(math.floor(a/b))
end end end
local env=setmetatable({},{__index=getfenv and getfenv()or _ENV})for k,v in pairs({print=print,warn=warn,error=error,type=type,typeof=typeof,tostring=tostring,tonumber=tonumber,pairs=pairs,ipairs=ipairs,next=next,select=select,unpack=unpack or table.unpack,pcall=pcall,xpcall=xpcall,rawget=rawget,rawset=rawset,rawequal=rawequal,setmetatable=setmetatable,getmetatable=getmetatable,newproxy=newproxy,coroutine=coroutine,string=string,table=table,math=math,bit32=bit32,os=os,task=task,game=game,workspace=workspace,script=script,wait=wait,delay=delay,spawn=spawn,tick=tick,time=time,Instance=Instance,Vector3=Vector3,Vector2=Vector2,CFrame=CFrame,Color3=Color3,BrickColor=BrickColor,UDim=UDim,UDim2=UDim2,Enum=Enum,Ray=Ray,Region3=Region3,Rect=Rect,TweenInfo=TweenInfo,NumberSequence=NumberSequence,ColorSequence=ColorSequence,NumberRange=NumberRange,NumberSequenceKeypoint=NumberSequenceKeypoint,ColorSequenceKeypoint=ColorSequenceKeypoint,PhysicalProperties=PhysicalProperties,Random=Random,debug=debug,utf8=utf8})do env[k]=v end
createVM(data,env)`;
}

module.exports = { generateVM };
