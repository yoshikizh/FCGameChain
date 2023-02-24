const fs = require('fs')
const path = require('path')

const C_MAGIC_STRING_NES =  "NES"
const C_CHR_MAGIC_STRING_NES_EOF = 0x1A

const MAPPER_0 = 0x00
const HEADER_BYTES = 0x10
const ADDR_PRG_ROM_START = 0x8000 


class FC {

}

// CPU(2A03）Registers
class FCCpuRegisters {
  constructor() {
    this.memory = null

    this.A = 0x00          // A 累加器
    this.X = 0x00          // X 索引寄存器
    this.Y = 0x00          // Y 索引寄存器
    this.PC = 0x0000       // 程序计数器
    this.SP = 0xFF         // 栈指针

    // 状态寄存器
    this.P = {
      C: 0,  // carry flag (C) - 进位标志
      Z: 0,  // zero flag (Z) - 结果是否为零
      I: 0,  // interrupt flag (I) - 是否允许中断
      D: 0,  // decimal mode flag (D) - 是否处于十进制模式
      B: 0,  // break flag (B) - 是否处于中断状态
      U: 0,  // 未使用标志
      V: 0,  // overflow flag (V) - 是否发生溢出
      N: 0,  // negative flag (N) - 最高位是否为1
    }
  }

  // LDA Immediate 操作
  _cmdLdaImmediate(){
    const value = this.memory.readByte(this.PC++).readInt8()
    this.A = value
    this.P.Z = this.A === 0x00
    this.P.N = ((this.A & 0x80) === 0x80)
  }

  // LSR 指令
  // 将操作数右移一位，移动的过程中最右边的一位变成了进位标志位 (Carry Flag)，
  // 而最左边的一位则补零。操作数可以是累加器 A，也可以是内存中的地址。
  _cmdLSR(){

    
    let value, result
    let saveInMemory = false

    // 先从累加器A中读取操作数 ，如果没有获取到则从内存中读取操作数
    if (this.A && this.A !== 0){
      value = this.A
    } else {
      // 读取 operand 地址处的值(操作数)
      value = this.memory.readByte(this.PC).readInt8()
      saveInMemory = true
    }

    const carry = value & 0x01
    result = value >> 1

    // 将右移后的操作数写回累加器或者内存中
    if (saveInMemory){
      this.memory.writeByte(value,this.PC)
    } else {
      this.A = value
    }

    // 设置标志寄存器
    this.P = 0
    if (result === 0) {
      this.P = this.P | (1 << 1) // zero flag
    }
    if (carry !== 0) {
      this.P = this.P | (1 << 0) // carry flag
    }
  }

  setMemory(memory){
	 this.memory = memory
  }

  // 解析指令
  parse(opcode){
    switch (opcode) {
      case 0x00:
        break;
      case 0x52: // LSR D 指令
        this._cmdLSR();
        break;
      case 0xA9: // LDA Immediate
        this._cmdLdaImmediate()
        break;
      // 其他指令，略过
      default:
        break;
    }
  }

  run(memory){
    // 设置 memory
    this.memory = memory

    // 设置 PC寄存器指向 0x8000
    this.PC = ADDR_PRG_ROM_START

    // 开始循环读取 byte
    while (this.PC < 0x10000) {
      // 读取指令
      let opcode
      try {
        opcode = this.memory.readByte(this.PC++)
      } catch (err){
        break
      }
      console.log("opcode ->", this.PC++, opcode.readInt8())
      this.parse(opcode.readInt8())
    }
    console.log("Out of memory")
    process.exit()
  }
}

// 16 Bytes Rom File Header
class StructHeader {
  constructor (){
    this.constant = Buffer.alloc(4)        // 0-3: Constant 45 1A ("NES" followed by MS-DOS end-of-file)
    this.prgRomSize = Buffer.alloc(1)      // 4: Size of PRG ROM in 16 KB units
    this.chrRomSize = Buffer.alloc(1)      // 5: Size of CHR ROM in 8 KB units (Value 0 means the board uses CHR RAM)
    this.flags6 = Buffer.alloc(1)          // 6: Flags 6 - Mapper, mirroring, battery, trainer
    this.flags7 = Buffer.alloc(1)          // 7: Flags 7 - Mapper, VS/Playchoice, NES 2.0
    this.flags8 = Buffer.alloc(1)          // 8: Flags 8 - PRG-RAM size (rarely used extension)
    this.flags9 = Buffer.alloc(1)          // 9: Flags 9 - TV system (rarely used extension)
    this.flags10 = Buffer.alloc(1)         // 10: Flags 10 - TV system, PRG-RAM presence (unofficial, rarely used extension)
    this.padding = Buffer.alloc(5)         // 11-15: Unused padding (should be filled with zero, but some rippers put their name across bytes 7-15)
  }

  // buff.copy(targetBuff, targetBuffStart, sourceBuffStart, sourceBuffEnd)
  loadHeader(romData){
    romData.copy(this.constant, 0,0,4)
    romData.copy(this.prgRomSize, 0,4,5)
    romData.copy(this.chrRomSize, 0,5,6)
    romData.copy(this.flags6, 0,6,7)
    romData.copy(this.flags7, 0,7,8)
    romData.copy(this.flags8, 0,8,9)
    romData.copy(this.flags9, 0,9,10)
    romData.copy(this.padding, 0,10,15)
  }
}

class FCRomReader {
  constructor(filePath){
    this.filePath = filePath
    this.fileInfo = null
    this.romData = null

  }

  readNESROM(){
    this.fileInfo = fs.statSync(this.filePath)
    this.romData = fs.readFileSync(this.filePath)
  }

  parseRomHeader(){

  }
}

class FCMemory {
  constructor(bytesize){
    this.bytesize = bytesize
    this.buffer = null

    this.init()
  }
  init(){
    this.buffer = Buffer.alloc(this.bytesize)
  }
  loadPRGRom(mapperNumber,prgRomBytesize,romData){
    if (mapperNumber === MAPPER_0){
      romData.copy(this.buffer, ADDR_PRG_ROM_START, HEADER_BYTES, HEADER_BYTES + prgRomBytesize)
      // 再拷贝一份
      romData.copy(this.buffer, ADDR_PRG_ROM_START + prgRomBytesize, HEADER_BYTES, HEADER_BYTES + prgRomBytesize)
    }
  }

  readByte(addr){
    return this.buffer.slice(addr, addr+1)
  }

  writeByte(byte,addr){
    this.buffer.writeInt8(byte, addr)
  }
}

class FCRunner {
  constructor(){
    this.romReader = null
    this.structRomHeader = null
    this.memory = null

    this.mapperNumber = null
    this.prgRomBytesize = null
    this.prgChrBytesize = null

    this.cpu = null

    this.init()
  }

  init(){
    this.initRomReader()
    this.initStructRomHeader()
    this.initMemory()
    this.initCpu()
  }

  initStructRomHeader(){
    this.structRomHeader = new StructHeader()
  }

  initRomReader(){
    const romFilePath = `${__dirname}/Antarctic Adventure (J).nes`
    this.romReader = new FCRomReader(romFilePath)
  }
  initMemory(){
    const memoryMaxBytes = 0x10000 // 64KB 内存
    this.memory = new FCMemory(memoryMaxBytes) 
  }
  initCpu(){
    this.cpu = new FCCpuRegisters()
  }

  loadRomHeader(){
    this.structRomHeader.loadHeader(this.romReader.romData)
  }

  checkRomHeader(){
    const nesConstant = this.structRomHeader.constant
    const magicStringNES = nesConstant.slice(0,3).toString()
    const eofChar = nesConstant.slice(3,4).readInt8()
    if (magicStringNES !== C_MAGIC_STRING_NES){
      throw new Error("Error 01 happened!")
    }
    if (eofChar !== C_CHR_MAGIC_STRING_NES_EOF){
      throw new Error("Error 02 happened!")
    }
  }

  setMapperNumber(){
    const flags6 = this.structRomHeader.flags6.readInt8()
    const flags7 = this.structRomHeader.flags7.readInt8()
    this.mapperNumber = (flags6 >> 4) | (flags7 & 0xf0)
  }
  setRomByteSize(){
    this.prgRomBytesize = this.structRomHeader.prgRomSize.readInt8() * 0x4000
    this.prgChrBytesize = this.structRomHeader.chrRomSize.readInt8() * 0x2000
  }

  runCpu(){
    this.cpu.run(this.memory)
  }

  run(){
    // 读取 rom
    this.romReader.readNESROM()
    // 先读取header
    this.loadRomHeader()
    // 检查header
    this.checkRomHeader()
    // 设置 Mapper Number
    this.setMapperNumber()
    // 设置 Rom Bytesize
    this.setRomByteSize()

    // 将 rom 写入 memory
    this.writePRGRomIntoMemory()

    // 开始运行cpu
    this.runCpu()
  }

  // example: Mapper0 -> start with 0x10 , length 16kb -> memory 0x8000
  writePRGRomIntoMemory(){
    this.memory.loadPRGRom(this.mapperNumber,this.prgRomBytesize,this.romReader.romData)
  }
}

function main(){
  var runner = new FCRunner()
  runner.run()
}


main()
