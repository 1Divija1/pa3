import {parser} from "lezer-python";
import {TreeCursor} from "lezer-tree";
import {BinaryOp, Expr, Stmt, VarInit, Type, TypedVar, Literal, UnaryOp, FunDef, Program} from "./ast";
import { stringifyTree } from "./treeprinter";

function isVarDecl(c: TreeCursor, s: string) : Boolean {

  if(c.type.name !== "AssignStatement")
    return false;
  c.firstChild();
  c.nextSibling();
  const name = c.type.name;
  c.parent();
  // @ts-ignore
  if(name !== "TypeDef")
    return false;
  return true;
}

function isFunDef(c: TreeCursor, s: string) : Boolean { 
  if(c.type.name !== "FunctionDefinition")
    return false;
  return true;
}

function traverseVarInit(c : TreeCursor, s : string) : VarInit<null> {
  c.firstChild(); // go to name
  const {name, type} = traverseTypedVar(c , s);
  c.nextSibling(); // =
  c.nextSibling(); //literal
  const literal = traverseLiteral(c,s);
  c.parent();
  return { name, type , init : literal}

}

export function traverseLiteral(c: TreeCursor, s: string): Literal<null> {
  switch (c.type.name) {
    case "Number":
      return {
        tag: "num",
        value: Number(s.substring(c.from, c.to))
      };
    case "Boolean":
      return {
        tag: "bool",
        value: (eval(s.substring(c.from, c.to).toLowerCase()))
        };
    case "None":
      return {
        tag: "none"
      };
    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

function traverseTypedVar(c : TreeCursor, s : string) : TypedVar<null> {
  const varDec = s.substring(c.from, c.to);
  c.nextSibling();  // a - TypeDef
  c.firstChild(); // :
  c.nextSibling(); //int / bool
  const type = traverseType(c,s);
  c.parent(); // pop TypeDef
  return { name : varDec , type : type}

}

export function traverseType(c: TreeCursor, s: string): Type {
  switch (s.substring(c.from, c.to)) {
    case "int":
      return Type.int;
    case "bool":
      return Type.bool;
    case "None":
      return Type.none;
    default:
      throw new Error("TYPE ERROR : Incorrect Type");
  }
}

export function traverseArgs(c : TreeCursor, s : string) : Array<Expr<null>> {
  var args : Array<Expr<null>> = [];
  c.firstChild(); // go into arglist
  while(c.nextSibling()) {
    args.push(traverseExpr(c, s));
    c.nextSibling();
  } 
  c.parent(); // pop arglist
  return args;
}

export function traverseExpr(c : TreeCursor, s : string) : Expr<null> {
  switch(c.node.type.name) {
    case "Number":
      return {
        tag: "literal",
        literal : traverseLiteral(c, s)
      }
    case "Boolean":
      return {
        tag: "literal",
        literal : traverseLiteral(c, s)
      }
    case "None":
      return {
        tag: "literal",
        literal : traverseLiteral(c, s)
      }

    case "VariableName":
      return {
        tag: "id",
        name: s.substring(c.from, c.to)
      }

    case "CallExpression":
      c.firstChild(); // we will reach print / abs / max / min / pow / f
      const callName = s.substring(c.from, c.to);
      if( callName == "abs" || callName == "print"){
        c.nextSibling(); // arglist
        c.firstChild(); // (
        c.nextSibling();
        const arg1 = traverseExpr( c , s);
        c.parent(); // pop arglist
        c.parent(); //pop call expression
        return {
          tag: "builtin1",
          name: callName,
          arg: arg1
        };
      }
      else if(callName == "pow" || callName == "max" || callName == "min" ){
        c.nextSibling(); // arglist
        c.firstChild(); // (
        c.nextSibling();
        const arg1 = traverseExpr( c , s);
        c.nextSibling() // op
        c.nextSibling() // arg2
        const arg2 = traverseExpr( c , s);
        c.parent(); // pop arglist
        c.parent(); //pop call expression
        return {
          tag: "builtin2",
          name: callName,
          arg1: arg1,
          arg2 : arg2
        };

      }
        
       else {
        // for cases like f(1,2) or f(1,2,3) .. any number of arguments are possible
        c.nextSibling(); // arglist
        c.firstChild(); // (
        c.nextSibling();
        const argum: Expr<null>[] = [];
        do {
          if (c.type.name === ")") break;   // function has no parameters
          argum.push(traverseExpr(c, s));
          c.nextSibling();
        } while(c.nextSibling())
        c.parent(); // pop arglist
        c.parent(); //pop call expression
        return {
          tag: "call",
          name: callName,
          args : argum
        };
       }
    
      case "UnaryExpression":
        c.firstChild(); // arg
        var op1 : UnaryOp;
        switch(op1) {
          case "-":
            op1 = UnaryOp.Minus
            break;
          case "not":
            op1 = UnaryOp.Not;
            break;
          default:
            throw new Error("PARSE ERROR : Incorrect Operator")
        }
        c.nextSibling();
        const argUnary = traverseExpr(c, s);        
        c.parent(); //pop Binarty Expression
        return {tag: "unaryexp", op : op1, left : argUnary};

      case "BinaryExpression":
        c.firstChild(); // left
        const left = traverseExpr(c, s);
        c.nextSibling(); // operator
        var op : BinaryOp;
        switch(s.substring(c.from, c.to)) {
          case "+":
            op = BinaryOp.Plus;
            break;
          case "-":
            op = BinaryOp.Minus;
            break;
          case "*":
            op = BinaryOp.Mul;
            break;
          case "//":
            op = BinaryOp.Div;
            break;
          case "%":
            op = BinaryOp.Mod;
            break;
          case "<":
            op = BinaryOp.Less;
            break;
          case "<=":
              op = BinaryOp.LessEqual;
              break;
          case ">":
            op = BinaryOp.Greater;
            break;
          case ">=":
            op = BinaryOp.GreaterEqual;
            break;
          case "==":
              op = BinaryOp.Equal;
              break;
          case "!=":
            op = BinaryOp.NotEqual;
            break;
          default:
            throw new Error("PARSE ERROR : Incorrect Operator")
        }
        c.nextSibling(); // right arg
        const right = traverseExpr(c, s);
        c.parent(); //pop Binary Expression
        return {tag: "binaryexp", op, left, right}; 
      case "ParenthesizedExpression":
        c.firstChild();
        c.nextSibling();
        const expr = traverseExpr(c,s);
        c.parent();
        return expr;  
    default:
      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt<null> {
  switch(c.node.type.name) {
    case "AssignStatement":
      c.firstChild(); // go to name
      const name = s.substring(c.from, c.to);
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      const value = traverseExpr(c, s);
      c.parent();
      return {
        tag: "assign",
        name: name,
        value: value
      }
    case "ExpressionStatement":
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr };
    case "⚠":
    case "PassStatement":
      { tag : "pass"}
    case "ReturnStatement":
      c.firstChild();  // return
      c.nextSibling(); // arg
      const value1 = traverseExpr(c, s);
      c.parent();
      return { tag: "return", expr : value1 };
    case "IfStatement":
      c.firstChild();// go to if
      c.nextSibling();// go to (
      var cond_if: Expr<null> = traverseExpr(c, s);
      console.log(cond_if);
      c.nextSibling(); // go to body
      c.firstChild(); // go to :
      var if_body: Stmt<null>[] = [];
      while(c.nextSibling()) {
        if_body.push(traverseStmt(c,s));
      }
      c.parent();
      console.log(s.substring(c.from, c.to));
      c.nextSibling(); // go to elseif
      console.log(s.substring(c.from, c.to));
      if(s.substring(c.from, c.to) == "elif") {
        console.log(s.substring(c.from, c.to));
        c.nextSibling();// go to (
        var cond_elseif: Expr<null> = traverseExpr(c, s);
        c.nextSibling(); // go to body
        c.firstChild(); // go to :
        var elseif_body: Stmt<null>[] = [];
        while(c.nextSibling()) {
          elseif_body.push(traverseStmt(c,s));
        }
        c.parent();
        c.nextSibling(); // go to else
      }
      if(s.substring(c.from, c.to) === "else") {
        console.log(s.substring(c.from, c.to));
          c.nextSibling(); // go to body
          c.firstChild(); // go to :
          var else_body: Stmt<null>[] = [];
          while(c.nextSibling()) {
            else_body.push(traverseStmt(c,s));
          }
        //  c.parent();

      }
      console.log("hi", s.substring(c.from, c.to));
      c.parent();
      console.log("hey", s.substring(c.from, c.to));
      c.parent();
      return { tag: "ifelse", ifcond: cond_if, ifbody: if_body, elif: cond_elseif, elifbody: elseif_body, elsebody: else_body };

    case "WhileStatement":
      const body: Stmt<null>[] = [];
      c.firstChild();   // while
      c.nextSibling();  // condition
      const cond = traverseExpr(c,s);
      c.nextSibling(); //body
      c.firstChild(); // :
      if (s.substring(c.from, c.to) != ':') {
        throw new Error("ParseError: missing colon");
      }
      c.nextSibling();  // first statement
      do {
        body.push(traverseStmt(c, s));
      } while(c.nextSibling())
      c.parent();
      c.parent();
      return { tag: "while", cond, body};
    default:
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseFunDef(c : TreeCursor, s : string) : FunDef<null>{
  c.firstChild();  //def
  c.nextSibling(); //function name
  const functionName = s.substring(c.from, c.to);
  c.nextSibling(); // ParamList
  c.firstChild(); // (
  c.nextSibling(); // param
  const paramList :TypedVar<null>[] = [];
  do {
    if (c.type.name === ")") break;   // function has no parameters
    paramList.push(traverseTypedVar(c, s));
    c.nextSibling();
  } while(c.nextSibling())
  c.parent();
  console.log("fun1", s.substring(c.from, c.to))
  c.nextSibling(); // TypeDef for return
  console.log("fun2", s.substring(c.from, c.to))
  var ret = Type.none ;
  if(c.type.name === "TypeDef") {
    c.firstChild(); // ->
    c.nextSibling(); // return type
    ret = traverseType(c,s);
    c.nextSibling();
    c.parent(); // goes to parent
  }
  c.nextSibling(); //Body
  c.firstChild(); //:
  if (s.substring(c.from, c.to) != ':') {
    throw new Error("ParseError: missing colon");
  }
  c.nextSibling(); // goes to first statement
  // we will have variable dec and statements in body
  const inits : VarInit<null>[] = [];
  const body : Stmt<null>[] = [];
  do{
    if(isVarDecl(c,s)){
      inits.push(traverseVarInit(c,s));
    }
    else if(isFunDef(c,s)){
      throw new Error("PARSE ERROR : nested functions not handled");
    }
    else{
      break;
    }
      
    }
  while(c.nextSibling())

  do{
    if (isVarDecl(c,s) || isFunDef(c,s)){
      throw new Error("PARSE ERROR :  variables and functions declaration should be first")
    }
    body.push(traverseStmt(c,s));
  } while(c.nextSibling())
  c.parent(); //body
  c.parent();
  // if no return is present
  if(ret == Type.none){
    body.push({tag : "return", expr : { tag : "literal", literal : {tag : "none"}}})
  }
  return {name : functionName , params : paramList , ret , inits, body }
}

export function traverseProgram(c : TreeCursor, s : string) : Program<null>{
  switch(c.node.type.name) {
    // parsing variables and functions first
    case "Script":
      const inits : VarInit<null>[] = [];
      const body : Stmt<null>[] = [];
      const funDefs : FunDef<null>[] = [];
      c.firstChild();
      do{
        if(isVarDecl(c,s)){
          inits.push(traverseVarInit(c,s));
          console.log(inits)
        }
        else if(isFunDef(c,s)){
          funDefs.push(traverseFunDef(c,s));
          console.log(funDefs)

        }
        else{
          break;
        }
        if(c.nextSibling()){
          continue;
        }
        else {
          return {varinits : inits , fundefs : funDefs , stmts : body};
        }
        }
      while(true)

      do{
        if(isVarDecl(c,s) || isFunDef(c,s)){
          throw new Error("PARSE ERROR : variables and functions declaration should be first");
        }
        else {
          body.push(traverseStmt(c,s));
        }
        traverseStmt(c, s);
       
      } while(c.nextSibling())
      console.log("inits",inits)
      console.log("fun",funDefs)
      console.log("body",body)

      return {varinits : inits , fundefs : funDefs , stmts : body};
    default:
      throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }


}


export function parse(source : string) : Program<null>{

  const t = parser.parse(source);
  const tree = stringifyTree(t.cursor(), source, 0);
  if(tree == "Script\n")
    throw new Error("No Input");
  console.log(tree);
  return traverseProgram(t.cursor(), source);
}
 