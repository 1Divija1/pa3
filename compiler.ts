import wabt from 'wabt';
import {Literal ,Type, UnaryOp, Stmt, Expr, BinaryOp,VarInit,MethodDef, ClassDef } from "./ast";
import { parse } from "./parser";
import { typeCheckProgram } from "./typecheck";

// https://learnxinyminutes.com/docs/wasm/

type LocalEnv = Map<string, boolean>;

type classEnv = Map<string, ClassDef<Type>>;

type varclassMapEnv = Map<string, string>;

var loop = 0;
type CompileResult = {
  wasmSource: string,
};

export async function run(watSource : string, config: any) : Promise<number> {
  const wabtApi = await wabt();

  const parsed = wabtApi.parseWat("example", watSource);
  const binary = parsed.toBinary({});
  const wasmModule = await WebAssembly.instantiate(binary.buffer, config);
  return (wasmModule.instance.exports as any)._start();
}

export function compile(source: string) : string {
  let ast = typeCheckProgram(parse(source));
  const emptyEnv = new Map<string, boolean>();
  const classMap = new Map<string, ClassDef<Type>>();
  var varclassMap = new Map<string, string>();
  // check for variables 
  const varDecls = ast.varinits.map(v => `(global $${v.name} (mut i32) (i32.const 0))`).join("\n");
  var heap = `(global $heap (mut i32) (i32.const 4))`
  const varInits : string[] = codeGenVarInits(ast.varinits, emptyEnv, varclassMap);
  
  //classes 
  const classdefs : string[] = [];
  ast.classdef.forEach(classes => {
    classMap.set(classes.name,classes);
    var str : string = codeGenClassDefs(classes, classMap, emptyEnv, varclassMap)
    if (str.length > 0) {
      classdefs.push(str);
    }
    classdefs.join("\n");
  })
  classdefs.join("\n\n");
  //  statements
  const allStmts = ast.stmts.map(s => codeGenStmt(s,emptyEnv, classMap, varclassMap)).flat();
  const main = [`(local $scratch i32)`,...varInits, ...allStmts].join("\n");

  var retType = "";
  var retVal = "";
  if(ast.stmts.length > 0) {
  const lastStmt = ast.stmts[ast.stmts.length - 1];
  const isExpr = lastStmt.tag === "expr";

  if(isExpr) {
    retType = "(result i32)";
    retVal = "(local.get $scratch)"
  }  
  }
  

  return `
    (module
      (memory (import "imports" "mem") 1)
      (func $print_num (import "imports" "print_num") (param i32) (result i32))
      (func $print_bool (import "imports" "print_bool") (param i32) (result i32))
      (func $print_none (import "imports" "print_none") (param i32) (result i32))
      (func $abs (import "imports" "abs") (param i32) (result i32))
      (func $min (import "imports" "min") (param i32 i32) (result i32))
      (func $max (import "imports" "max") (param i32 i32) (result i32))
      (func $pow (import "imports" "pow") (param i32 i32) (result i32))
      ${heap}
      ${varDecls}
      ${classdefs}
      (func (export "_start") ${retType}
        ${main}
        ${retVal}
      )
    ) 
  `;
}

function codeGenClassDefs(classdef : ClassDef<Type>, classenv: classEnv, localenv : LocalEnv, varclassMap : varclassMapEnv) : string{
  
  //methods
  const methoddef : string[] = [];
  var init_str : string = "";
  var init_found : boolean = false;
  if(classdef.methodDefs.length > 0) {
    classdef.methodDefs.forEach(method => {
      if (method.name == "__init__") {
        init_found = true;
      }
      methoddef.push(codeGenMethod(classdef, method, classenv,localenv, varclassMap).join("\n"));
    })
    if (!init_found) {
      init_str = `(func $__init__$${classdef.name} (param $self i32) (result i32)
      (local $scratch i32)
      (local.get $self)
      (return)
      (i32.const 0))`
    }
    methoddef.join("\n\n");  
  }
  if (init_str.length > 0) {
    return `${init_str}
          ${methoddef}`;
  } else {
    return `${methoddef}`;
  }
}

function codeGenVarInits(varInit : VarInit<Type>[], env: LocalEnv, varclassMap : varclassMapEnv) : string[] {

  var compiledDefs:string[] = []; 
  varInit.forEach(v => {
    // @ts-ignore
    if (v.type.class != undefined) {
      // @ts-ignore
      varclassMap.set(v.name, v.type.class)
    }
    if(env.has(v.name)) {
       compiledDefs.push(`(local $${v.name} i32)`);

       compiledDefs = [...compiledDefs,...codeGenLiteral(v.init)];

       compiledDefs.push(`(local.set $${v.name})`); 
      }
    else { 
      compiledDefs = [...compiledDefs,...codeGenLiteral(v.init)];
      compiledDefs.push(`(global.set $${v.name})`); }  

  });
  return compiledDefs;
}

export function codeGenMethod(classdef : ClassDef<Type>, func: MethodDef<Type>, classenv: classEnv , 
    locals: LocalEnv, varclassMap : varclassMapEnv) : Array<string> {
  const withParamsAndVariables = new Map<string, boolean>(locals.entries());
  func.params.forEach(p => withParamsAndVariables.set(p.name, true));
  const params = func.params.map(p => `(param $${p.name} i32)`).join(" ");

  func.inits.forEach(v => withParamsAndVariables.set(v.name, true));
  const varDecls = codeGenVarInits(func.inits, withParamsAndVariables, varclassMap).join("\n");

  const stmts = func.body.map(s => codeGenStmt(s, withParamsAndVariables, classenv, varclassMap)).map(f => f.join("\n"));
  const stmtsBody = stmts.join("\n");

  if(func.name == "__init__"){
    return [`(func $${func.name} ${classdef.name} ${params}  (result i32)
    (local $scratch i32)
    (local.get $${func.params[0].name})
    (return)
    ${varDecls}
    ${stmtsBody}`,`(i32.const 0)`,` )`];
  }
  else {
  return [`(func $${func.name} ${classdef.name} ${params}  (result i32)
  (local $scratch i32)
  ${varDecls}
  ${stmtsBody}`,`(i32.const 0)`,` )`];
 }
}
  


export function codeGenLiteral(literal : Literal<Type>) {
  switch(literal.tag){
    case "num" : return [`(i32.const ${literal.value})`];
    case "bool": 
      if(literal.value) 
        return [`(i32.const 1)`];
      else 
        return [`(i32.const 0)`]; 
    case "none":
      return [`(i32.const 0)`]; 
  }
}

export function codeGenBinaryOp(op : BinaryOp) {
  switch(op) {
    case BinaryOp.Plus: return [`i32.add`];
    case BinaryOp.Minus: return [`i32.sub`];
    case BinaryOp.Mul: return [`i32.mul`];
    case BinaryOp.Div: return [`.32.div_s`];
    case BinaryOp.Mod: return [`i32.rem_s`];
    case BinaryOp.Greater: return [`i32.gt_s`];
    case BinaryOp.GreaterEqual: return [`i32.ge_s`];
    case BinaryOp.Less: return [`i32.lt_s`];
    case BinaryOp.LessEqual: return [`i32.le_s`];
    case BinaryOp.Equal: return [`i32.eq`];
    case BinaryOp.NotEqual: return [`i32.ne`];
    default:
      throw new Error(`Unhandled or unknown op: ${op}`);
  }
}

export function codeGenUnaryOp(op : UnaryOp){
switch(op){
  case UnaryOp.Not: return [`i32.eqz`];
  case UnaryOp.Minus: return [`i32.sub`];
  default:
      throw new Error(`Unhandled or unknown Unary op: ${op}`);
}
}

function codeGenStmt(stmt: Stmt<Type>, locals : LocalEnv, classenv: classEnv, varclassMap: varclassMapEnv) : Array<string> {
  switch(stmt.tag) {
    case "assign":
      var assignstmt = codeGenExpr(stmt.value, locals, classenv);
      if(locals.has(stmt.name)) { assignstmt.push(`(local.set $${stmt.name})`); }
      else { assignstmt.push(`(global.set $${stmt.name})`); }
      return assignstmt;
    
    case "luassign":
      var lhs = codeGenExpr(stmt.lhs, locals, classenv);
      var rhs = codeGenExpr(stmt.rhs, locals, classenv);
      //@ts-ignore
      var name : any = varclassMap.get(stmt.lhs.name)
      var classData = classenv.get(name).varinits
      var indexoffield = indexField(classData, stmt.name)
    return [ ...lhs, `(i32.const ${indexoffield*4})`, `(i32.add)`,...rhs,`(i32.store)`]

    case "return":
      var result = codeGenExpr(stmt.expr, locals, classenv);
      result.push("return")
      return result;

    case "pass":
      return [];

    case "expr":
      var result = codeGenExpr(stmt.expr, locals, classenv);
      result.push("(local.set $scratch)");
      return result;
    case "ifelse": {
      var result : string[] = [];
      console.log("result", result);
      let ifcond = codeGenExpr(stmt.ifcond, locals, classenv)
      var ifbody = stmt.ifbody.map(s => codeGenStmt(s, locals, classenv, varclassMap)).flat();
      console.log("comp cond" , ifcond);
      console.log("comp ifbody" , ifbody);
      result.push(...ifcond, `(if`, `(then`, ...ifbody, `)`);
      if(stmt.elif != null) {
      var elifcond = codeGenExpr(stmt.elif, locals, classenv)
      var elifbody = stmt.elifbody.map(s => codeGenStmt(s, locals, classenv, varclassMap)).flat();
      if (elifcond.length > 0) {
        result.push(`(else`, ...elifcond, `(if`, `( then`, ...elifbody, `)`, `)`, `)`);
        }
      }
      
      var elsebody = stmt.elsebody.map(s => codeGenStmt(s, locals, classenv, varclassMap)).flat();
      if (elsebody.length > 0) {
        result.push(`(else`, ...elsebody, `)`);
      }
      result.push(`)`);
      return result;
    }
    case "while":{
      var condLabel = loop;
      loop += 1;
      var bodyLabel = loop;
      loop += 1;
    var condExpr = codeGenExpr(stmt.cond, locals, classenv);

    var bodyStmts = stmt.body.map(s => codeGenStmt(s, locals, classenv, varclassMap)).flat();
    return [`(block $label_${bodyLabel}`,
            `(loop $label_${condLabel}`,
            ...condExpr,
            `i32.eqz`,
            `br_if $label_${bodyLabel}`,
            ...bodyStmts,
            `br $label_${condLabel}`,`)`,`)`];
}

  }

function codeGenExpr(expr : Expr<Type>, locals : LocalEnv, classenv: classEnv) : Array<string> {
  switch(expr.tag) {
    case "literal": return codeGenLiteral(expr.literal);
    case "id":
      // Since we type-checked for making sure all variable exist, here we
      // just check if it's a local variable and assume it is global if not
      if(locals.has(expr.name)) { return [`(local.get $${expr.name})`]; }
      else { return [`(global.get $${expr.name})`]; }
    case "builtin1":
        const argStmts = codeGenExpr(expr.arg , locals, classenv);
        let toCall1 = expr.name;
        if(expr.name === "print") {
        switch(expr.arg.a) {
          case "bool": toCall1 = "print_bool"; break;
          case "int": toCall1 = "print_num"; break;
          case "none": toCall1 = "print_none"; break;
          case undefined : toCall1 = "print_num"; break;
        }
      }
      argStmts.push(`(call $${toCall1})`);
      return argStmts;
    case "builtin2":
        const argStmts1 = codeGenExpr(expr.arg1 , locals, classenv);
        const argStmts2 = codeGenExpr(expr.arg2, locals, classenv);
        return [...argStmts1, ...argStmts2, `(call $${expr.name})`]; 
    case "binaryexp": {
      const lhsExprs = codeGenExpr(expr.left, locals, classenv);
      const rhsExprs = codeGenExpr(expr.right, locals, classenv);
      const opstmts = codeGenBinaryOp(expr.op);
      return [...lhsExprs, ...rhsExprs, ...opstmts];
    }
    case "unaryexp": {
      var exprs = codeGenExpr(expr.left, locals, classenv);
      const op = codeGenUnaryOp(expr.op);
      return [`i32.const 0`, ...exprs, ...op];
  }
    case "call":
      if(classenv.has(expr.name)){
        let initvals : string[] = [];
        const classdata = classenv.get(expr.name);
        classdata.varinits.forEach((f,index)=>{
          var offset = index * 4;
          initvals = [
              ...initvals,
              `(global.get $heap)`,
              `(i32.add (i32.const ${offset}))`,
               ...codeGenLiteral(f.init),
              `i32.store`
          ];
        });
        return [
          ...initvals,
          `(global.get $heap)`,
          `(global.set $heap (i32.add (global.get $heap)(i32.const ${classdata.varinits.length*4})))`
        ]
      }
      const valStmts = expr.args.map(e => codeGenExpr(e, locals, classenv)).flat();
      return valStmts;
    
    case "lookup":
      const objstmts = codeGenExpr(expr.obj, locals, classenv)
      //@ts-ignore
      var classData = classenv.get(expr.obj.a.class).varinits
      var indexoffield = indexField(classData, expr.name)
      return [ ...objstmts, `(i32.const ${indexoffield*4})`, `(i32.add)`,`(i32.load)`]

  }
}

function indexField(varInit : VarInit<Type>[], field : string) : number {
var indexofField : number = -1
for(var idx = 0 ; idx < varInit.length; idx++){
  if(varInit[idx].name == field) 
      indexofField = idx
}
return indexofField;
} 
}
