import { Expr, MethodDef, Literal, Program , Type, VarInit, Stmt, TypedVar, UnaryOp, BinaryOp, ClassDef}  from './ast';

//This Map stores the variable and Type when we declare a variable
// we use this to check if the var exists in this or when we are making
// function calls, we can check if the function is present
// vars = variable name and type of variable
// funs = function name , type of arguments, return type
type TypeEnv = {
    vars : Map<string, Type>,
    classes : Map<string, ClassData>,
    retType : Type
}

type ClassData = {
    vars : Map<string, Type>,
    funs : Map<string, [Type[], Type]>,
}


function duplicateEnv(env: TypeEnv) : TypeEnv {
    return { vars : new Map(env.vars), classes : new Map(env.classes), retType : env.retType}
}

function ClassData(classenv : ClassData) : ClassData {
    return { vars : new Map(classenv.vars), funs : new Map(classenv.funs)}
}


export function typeCheckProgram(prog:Program<null>) : Program<Type>{
    //create new env
    const env : TypeEnv = {
        vars: new Map(), classes: new Map(), retType : "none"};

    // check inits
    const typedVarInit = typeCheckVarInit(prog.varinits, env);
    prog.varinits.forEach(init => {
        env.vars.set(init.name, init.type);

    })

    // add classes defs to env
    // check classes
    const classDefs : ClassDef<Type>[] = [];
    prog.classdef.forEach(clas => {
        const classdef = typeCheckClassDefs(clas, env);
        classDefs.push(classdef)
       
    })

    // check statements

    const typedStmts = typeCheckStmts(prog.stmts, env)


    return {...prog, varinits : typedVarInit , classdef : classDefs , stmts : typedStmts};
    
}


// Typed Checked variable initialization in Typing env
export function typeCheckVarInit(inits: VarInit<null>[], env: TypeEnv) : VarInit<Type>[]{
    const typedInits : VarInit<Type>[] = [];
    inits.forEach(init => {
        const typedInit = typeCheckLiteral(init.init)
        //@ts-ignore
        if (init.type != 'none' && init.type.tag == 'object') {
            //@ts-ignore
            if (typedInit.a != "none") {
                throw new Error("TYPE ERROR: Init Type does not match literal Type")   
            }
        }
        //@ts-ignore
        else if (typedInit.a !== init.type)
            throw new Error("TYPE ERROR: Init Type does not match literal Type")
        env.vars.set(init.name, init.type);
        typedInits.push({...init , a : init.type, init: typedInit});
    });
    return typedInits;
}


export function typeCheckParams(params: TypedVar<null>) : TypedVar<Type> {
 
        return{ ...params, a: params.type};
        
}

export function typeCheckClassDefs( classes : ClassDef<null> , env : TypeEnv) : ClassDef<Type>{
    const classdata : ClassData = {
        vars: new Map(), funs: new Map()
    }

    // check inits
    const typedVarInit = typeCheckVarInit(classes.varinits, env);
    typedVarInit.forEach(v =>{
        classdata.vars.set(v.name, v.type)
        env.classes.set(classes.name , classdata);

    })


    // add function defs to env
    // check function
    const methodDefs : MethodDef<Type>[] = [];
    classes.methodDefs.forEach(funs => {
        const funDef = typeCheckFunDefs(funs, env);
        classdata.funs.set(funs.name, [funs.params.map(param => param.type), funs.ret])
        env.classes.set(classes.name , classdata );
        methodDefs.push(funDef);
    })
    return {...classes, varinits : typedVarInit , methodDefs : methodDefs}

}

export function typeCheckFunDefs( fun :  MethodDef<null>, env: TypeEnv) : MethodDef<Type> {
    const localEnv = duplicateEnv(env);
    // Check and add Function params to env


    const typedParams : TypedVar<Type>[] = [];
    fun.params.forEach(param =>  {
        const typedParam = typeCheckParams(param);
        localEnv.vars.set(typedParam.name, param.type);
        typedParams.push(typedParam);
    })

    // add inits to env
    // check inits

    const typedInits = typeCheckVarInit(fun.inits, env)
    fun.inits.forEach(init => {
        localEnv.vars.set(init.name, init.type)

    })
    // add function type to env
   // localEnv.funs.set(fun.name , [fun.params.map(param => param.type), fun.ret])

    // add return type
    localEnv.retType = fun.ret
    // check body
    // make sure every path has the expected return type
    const typedStmts = typeCheckStmts(fun.body, localEnv)

    return {...fun, params : typedParams,  inits : typedInits, body: typedStmts };
}

export function typeCheckStmts(stmts : Stmt<null>[], env: TypeEnv) : Stmt<Type>[] {
const typedStmts : Stmt<Type>[] = [];

    stmts.forEach(stmt => {
    switch(stmt.tag) {
        case "assign":
            // a = 0
            // this check is a is present in the env
            if( !env.vars.has(stmt.name))
                throw new Error("TYPE ERROR : unbound id")
            //    
            const typedValue = typeCheckExpr(stmt.value , env);
            if (typedValue.a != undefined && typedValue.a !== env.vars.get(stmt.name))
                throw new Error("TYPE ERROR : cannot assign value to id")
            typedStmts.push({...stmt, value : typedValue, a: "none" as Type})
            break;
        
        case "luassign":
            const lhs = typeCheckExpr(stmt.lhs , env);
            //@ts-ignore
            if(lhs.a.tag != "object"){
                throw new Error("TYPE ERROR: obj is not of type object");
            }
            if(lhs.a == "int" || lhs.a == "bool" || lhs.a == "none"){
                throw new Error("TYPE ERROR: obj is not of type object");
            }
            var field = env.classes.get(lhs.a.class).vars.get(stmt.name)

            if(undefined == field){
                throw new Error("TYPE ERROR : variable not present in class")
            }
            
            const rhs = typeCheckExpr(stmt.rhs , env);
            if(rhs.a != field){
                throw new Error("TYPE ERROR : Type mismatch on both sides of the equality symbol")
            }
            typedStmts.push({...stmt, lhs, name : stmt.name, rhs })

            break;
        
        case "return":
            const typedRet = typeCheckExpr(stmt.expr, env);
            if( env.retType !== typedRet.a)
                throw new Error("TYPE ERROR: return type not matching")
            typedStmts.push({...stmt });

            break;
        
        case "ifelse": {
            const ifcond = typeCheckExpr(stmt.ifcond, env);
            if(ifcond.a != "bool") {
                throw new TypeError("Expect type BOOL in condition")
            }
            const ifBody = typeCheckStmts(stmt.ifbody, env);

            var elifcond
            var elifBody

            if(stmt.elif != null) {
                elifcond = typeCheckExpr(stmt.elif, env);
                if(elifcond.a != "bool") {
                    throw new TypeError("Expect type BOOL in condition")
                }
                if (stmt.elifbody ) elifBody = typeCheckStmts(stmt.elifbody, env);

            }
            
            
            const elseBody = typeCheckStmts(stmt.elsebody, env);
            console.log("ifcond", ifcond)
            console.log("ifbody", ifBody)
            console.log("elifcond", elifcond)
            console.log("elifbody", elifBody)
            console.log("elsebody", elseBody)


            typedStmts.push({...stmt, ifcond : ifcond, ifbody: ifBody,elif: elifcond, elifbody: elifBody, elsebody: elseBody});
        }
        break;
       case "while": {
            const ifcond = typeCheckExpr(stmt.cond, env);
            if(ifcond.a != "bool") {
                throw new TypeError("Expect type BOOL in condition")
            }

            const newBody = typeCheckStmts(stmt.body,env);

            typedStmts.push({ ...stmt, cond: ifcond, body: newBody});

        }
        break;
        case "pass":
            typedStmts.push({...stmt, a:"none" as Type});
            break;
        case "expr":
            const typedExpr = typeCheckExpr(stmt.expr, env);
            typedStmts.push({...stmt, expr: typedExpr, a: "none" as Type});
            break;
         default:
            throw new Error("TYPE ERROR : Statement not handled")
    }
})
    return typedStmts;
}


export function typeCheckExpr(expr: Expr<null>, env: TypeEnv) : Expr<Type> {
    switch(expr.tag){
        case "id":
            if(!env.vars.has(expr.name))
                throw new Error("TYPE CHECK: unbound id")
            const idType = env.vars.get(expr.name);
            return { ...expr, a: idType}
        
        case "builtin1":
            const arg = typeCheckExpr(expr.arg, env);
            return{ ...expr, arg : arg, a: "int" as Type}
           
        case "builtin2":
            const arg1 = typeCheckExpr(expr.arg1, env);
            const arg2 = typeCheckExpr(expr.arg2, env);
            if(arg1.a !== "int" as Type)
                throw new Error("TYPE ERROR: arg1 must be int");
             if(arg2.a !== "int" as Type)
                 throw new Error("TYPE ERROR: arg2 must be int");
            return{ ...expr, arg1 : arg1, arg2 : arg2, a: "int" as Type};
        case "unaryexp":
            const argUni = typeCheckExpr(expr.left, env);
            switch(expr.op){
                case "not": 
                    if(argUni.a !== "bool" as Type)
                        throw new Error("TYPE ERROR : Unary : Argument Not Bool ")
                    return { ...expr , a : "bool" as Type}
                case "-":
                    if(argUni.a != "int" as Type)
                        throw new Error("TYPE ERROR : Unary : Argument Not Int ")
                    return { ...expr , a : "int" as Type}
                default:
                    throw new Error("TYPE ERROR : Unary not supported")
            }
        case "binaryexp":
            const left = typeCheckExpr(expr.left, env);
            const right = typeCheckExpr(expr.right, env);
            switch(expr.op){
                case "+":
                case "-":
                case "*":
                case "//":
                case "%":
                    if(left.a != "int" as Type && right.a != "int" as Type)
                        throw new Error("TYPE ERROR : Binary : Argument Not Int ")
                    return {...expr, a : "int" as Type}
                case "<":
                case ">":
                case "<=":
                case ">=":
                    if(left.a != "int" as Type && right.a != "int" as Type)
                        throw new Error("TYPE ERROR : Binary : Argument Not Int ")
                return {...expr, a : "bool" as Type}
                case "==":
                case "!=":
                    if((left.a != "int" as Type && right.a != "int" as Type) || (left.a != "bool" as Type && right.a != "bool" as Type) )
                        throw new Error("TYPE ERROR : Binary : Argument Not Right ")
                    return {...expr, a : "bool" as Type}
                    
                default:
                    throw new Error("TYPE ERROR : Binary not supported")
            }

        
        case "call":
            const callargs = expr.args.map(a => typeCheckExpr(a, env))
            return {...expr, args : callargs};
        
        case "methodcall":
                const obj = typeCheckExpr(expr.obj, env);
                //@ts-ignore
                if(obj.a.tag != "object"){
                    throw new Error("TYPE ERROR: obj is not of type object");
                } 
                
                if(obj.a == "int" || obj.a == "bool" || obj.a == "none"){
                    throw new Error("TYPE ERROR: obj is not of type object");
                }
                
                if(!env.classes.has(obj.a.tag)) {
                    throw new Error("TYPE ERROR: incorrect class name");
                 }

                const classdata = env.classes.get(obj.a.tag);

                if(!classdata.funs.has(expr.name)) { 
                    throw new Error("TYPE ERROR: No method with the given name");;
                 }
                
                const newArgs = expr.args.map(a => typeCheckExpr(a, env));

                const [argTyps, retTyp] = classdata.funs.get(expr.name);
                if (argTyps.length !== newArgs.length) {
                    throw new Error( "Arity mismatch");
                 } 
                argTyps.forEach((t, i) => {
                //@ts-ignore
                if( (t.tag == "object")  !=  (newArgs[i].a.tag == "object")) { 
                    throw ("Mismatched in arg type and actual arg type"); 
                }
                if( t === "int" || t === "bool" || t === "none"){
                    if(t != newArgs[i].a ){
                        throw ("Mismatched in arg type and actual arg type"); 
                    }
                }
                });
                 return { ...expr, obj: obj, args: newArgs };

        case "lookup":
            const lhs = typeCheckExpr(expr.obj , env);
            //@ts-ignore
            if(lhs.a.tag != 'object'){
                throw new Error("TYPE ERROR: obj is not of type object");
            }
            if(lhs.a == "int" || lhs.a == "bool" || lhs.a == "none"){
                throw new Error("TYPE ERROR: obj is not of type object");
            }
            var field = env.classes.get(lhs.a.class).vars.get(expr.name)
            if(undefined == field){
                throw new Error("TYPE ERROR : variable not present in class")
            }

            return {...expr, obj : lhs, name : expr.name}
        case "literal":
            const lit = typeCheckLiteral(expr.literal)
            //@ts-ignore
            return { ...expr, a : lit.a}
        default:
            throw new Error("TYPE ERROR : This type of expression not handled")
    }

}
export function typeCheckLiteral(literal : Literal<null>) : Literal<Type> {
    switch(literal.tag){
        case "num":
            return { ...literal, a : "int"};
        case "bool":
            return { ...literal, a: "bool"};
        case "none":
            return { ...literal, a: "none"};
    }

}