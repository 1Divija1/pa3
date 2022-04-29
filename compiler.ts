import wabt from 'wabt';
import {Literal ,Type, UnaryOp, Stmt, Expr, BinaryOp,VarInit,FunDef } from "./ast";
import { parse } from "./parser";
import { typeCheckProgram } from "./typecheck";

// https://learnxinyminutes.com/docs/wasm/

type LocalEnv = Map<string, boolean>;
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
  // check for variables 
  const varDecls = ast.varinits.map(v => `(global $${v.name} (mut i32) (i32.const 0))`).join("\n");
  const varInits : string[] = codeGenVarDefs(ast.varinits, emptyEnv);
  
  //function 
  const funcdef : string[] = [];
  ast.fundefs.forEach(f => {
    funcdef.push(codeGenFunction(f, emptyEnv).join("\n"));
  })
  funcdef.join("\n\n");
  //  statements
  const allStmts = ast.stmts.map(s => codeGenStmt(s, emptyEnv)).flat();
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
      (func $print_num (import "imports" "print_num") (param i32) (result i32))
      (func $print_bool (import "imports" "print_bool") (param i32) (result i32))
      (func $print_none (import "imports" "print_none") (param i32) (result i32))
      (func $abs (import "imports" "abs") (param i32) (result i32))
      (func $min (import "imports" "min") (param i32 i32) (result i32))
      (func $max (import "imports" "max") (param i32 i32) (result i32))
      (func $pow (import "imports" "pow") (param i32 i32) (result i32))
      ${varDecls}
      ${funcdef}
      (func (export "_start") ${retType}
        ${main}
        ${retVal}
      )
    ) 
  `;
}
function codeGenVarDefs(varInit : VarInit<Type>[], env: LocalEnv) : string[] {

  var compiledDefs:string[] = []; 
  varInit.forEach(v => {
    if(env.has(v.name)) {
       console.log(v.name)
       compiledDefs.push(`(local $${v.name} i32)`);

       compiledDefs = [...compiledDefs,...codeGenLiteral(v.init, env)];

       compiledDefs.push(`(local.set $${v.name})`); 
      }
    else { 
      compiledDefs = [...compiledDefs,...codeGenLiteral(v.init, env)];
      compiledDefs.push(`(global.set $${v.name})`); }  

  });
  return compiledDefs;
}

export function codeGenFunction(func: FunDef<Type>, locals :LocalEnv) : Array<string> {
  const withParamsAndVariables = new Map<string, boolean>(locals.entries());
  func.params.forEach(p => withParamsAndVariables.set(p.name, true));
  const params = func.params.map(p => `(param $${p.name} i32)`).join(" ");

  func.inits.forEach(v => withParamsAndVariables.set(v.name, true));
  const varDecls = codeGenVarDefs(func.inits, withParamsAndVariables).join("\n");

  const stmts = func.body.map(s => codeGenStmt(s, withParamsAndVariables)).map(f => f.join("\n"));
  const stmtsBody = stmts.join("\n");
  return [`(func $${func.name} ${params} (result i32)
    (local $scratch i32)
    ${varDecls}
    ${stmtsBody}`,`(i32.const 0)`,` )`];
}


export function codeGenLiteral(literal : Literal<Type>, locals : LocalEnv) {
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

function codeGenStmt(stmt: Stmt<Type>, locals : LocalEnv) : Array<string> {
  switch(stmt.tag) {
    case "assign":
      var assignstmt = codeGenExpr(stmt.value, locals);
      if(locals.has(stmt.name)) { assignstmt.push(`(local.set $${stmt.name})`); }
      else { assignstmt.push(`(global.set $${stmt.name})`); }
      return assignstmt;

    case "return":
      var result = codeGenExpr(stmt.expr, locals);
      result.push("return")
      return result;

    case "pass":
      return [];

    case "expr":
      var result = codeGenExpr(stmt.expr, locals);
      result.push("(local.set $scratch)");
      return result;
    case "ifelse": {
      var result : string[] = [];
      console.log("result", result);
      let ifcond = codeGenExpr(stmt.ifcond, locals)
      var ifbody = stmt.ifbody.map(s => codeGenStmt(s, locals)).flat();
      console.log("comp cond" , ifcond);
      console.log("comp ifbody" , ifbody);
      result.push(...ifcond, `(if`, `(then`, ...ifbody, `)`);
      if(stmt.elif != null) {
      var elifcond = codeGenExpr(stmt.elif, locals)
      var elifbody = stmt.elifbody.map(s => codeGenStmt(s, locals)).flat();
      if (elifcond.length > 0) {
        result.push(`(else`, ...elifcond, `(if`, `( then`, ...elifbody, `)`, `)`, `)`);
        }
      }
      
      var elsebody = stmt.elsebody.map(s => codeGenStmt(s, locals)).flat();
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
    var condExpr = codeGenExpr(stmt.cond, locals);

    var bodyStmts = stmt.body.map(s => codeGenStmt(s, locals)).flat();
    return [`(block $label_${bodyLabel}`,
            `(loop $label_${condLabel}`,
            ...condExpr,
            `i32.eqz`,
            `br_if $label_${bodyLabel}`,
            ...bodyStmts,
            `br $label_${condLabel}`,`)`,`)`];
}

  }

function codeGenExpr(expr : Expr<Type>, locals : LocalEnv) : Array<string> {
  switch(expr.tag) {
    case "literal": return codeGenLiteral(expr.literal , locals);
    case "id":
      // Since we type-checked for making sure all variable exist, here we
      // just check if it's a local variable and assume it is global if not
      if(locals.has(expr.name)) { return [`(local.get $${expr.name})`]; }
      else { return [`(global.get $${expr.name})`]; }
    case "builtin1":
        const argStmts = codeGenExpr(expr.arg , locals);
        let toCall1 = expr.name;
        if(expr.name === "print") {
        switch(expr.arg.a) {
          case Type.bool: toCall1 = "print_bool"; break;
          case Type.int: toCall1 = "print_num"; break;
          case Type.none: toCall1 = "print_none"; break;
        }
      }
      argStmts.push(`(call $${toCall1})`);
      return argStmts;
    case "builtin2":
        const argStmts1 = codeGenExpr(expr.arg1 , locals);
        const argStmts2 = codeGenExpr(expr.arg2, locals);
        return [...argStmts1, ...argStmts2, `(call $${expr.name})`]; 
    case "binaryexp": {
      const lhsExprs = codeGenExpr(expr.left, locals);
      const rhsExprs = codeGenExpr(expr.right, locals);
      const opstmts = codeGenBinaryOp(expr.op);
      return [...lhsExprs, ...rhsExprs, ...opstmts];
    }
    case "call":
      const valStmts = expr.args.map(e => codeGenExpr(e, locals)).flat();
      let toCall = expr.name;
      if(expr.name === "print") {
        switch(expr.args[0].a) {
          case Type.bool: toCall = "print_bool"; break;
          case Type.int: toCall = "print_num"; break;
          case Type.none: toCall = "print_none"; break;
        }
      }
      valStmts.push(`(call $${toCall})`);
      return valStmts;
  }
}
}
