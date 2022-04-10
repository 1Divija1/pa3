import { Expr, FunDef, Literal, Program , Type, VarInit, Stmt, TypedVar}  from './ast';

//This Map stores the variable and Type when we declare a variable
// we use this to check if the var exists in this or when we are making
// function calls, we can check if the function is present
// vars = variable name and type of variable
// funs = function name , type of arguments, return type
type TypeEnv = {
    vars : Map<string, Type>,
    funs : Map<string, [Type[], Type]>,
    retType : Type
}

function duplicateEnv(env: TypeEnv) : TypeEnv {
    return { vars : new Map(env.vars) , funs : new Map(env.funs), retType : env.retType}
}


export function typeCheckProgram(prog:Program<null>) : Program<Type>{

}

// Typed Checked variable initialization in Typing env
export function typeCheckVarInit(inits: VarInit<null>[], env: TypeEnv) : VarInit<Type>[]{
    const typedInits : VarInit<Type>[] = [];
    inits.forEach((init) => {
        const typedInit = typeCheckLiteral(init.init)
        if (typedInit.a !== init.type)
            throw new Error("TYPED ERROR: Init Type does not match literal Type")
        env.vars.set(init.name, init.type);
        typedInits.push({...init, a : init.type, init: typedInit})
    })
    return typedInits;
}

export function typeCheckFunDefs( fun :  FunDef<null>, env: TypeEnv) : FunDef<Type>[] {
    const localEnv = duplicateEnv(env);
    // add params to env
    fun.params.forEach(param =>  {
        localEnv.vars.set(param.name, param.type)

    })
    const typedParams = typeCheckParams(fun.params)
    // add inits to env
    // check inits

    const typedInits = typeCheckVarInit(fun.inits, env)
    fun.inits.forEach(init => {
        localEnv.vars.set(init.name, init.type)

    })
    // add function type to env
    localEnv.funs.set(fun.name , [fun.params.map(param => param.type), fun.ret])

    // ass return type
    localEnv.retType = fun.ret
    // check body
    // make sure every path has the expected return type
    const typedStmts = typeCheckStmts(fun.body, localEnv)
    return {...fun, params : typedParams, inits : typedInits, body: typeCheckStmts };
}

export function typeCheckStmts(stmts : Stmt<null>[], env: TypeEnv) : Stmt<Type>[] {
const typedStmts : Stmt<Type>[] = [];

    stmts.forEach(stmt => {
    switch(stmt.tag) {
        case "assign":
            // a = 0
            if( !env.vars.get(stmt.name))
                throw new Error("TYPE ERROR :  unbound id")
            const typedValue = typeCheckExpr(stmt.value , env);
            if ( typedValue.a !== env.vars.get(stmt.name))
                throw new Error("TYPE ERROR : cannot assign value to id")
            typedStmts.push({...stmt, value : typedValue, a: Type.none})
            break;
        case "return":
            const typedRet = typeCheckExpr(stmt.ret, env);
            if( env.retType !== typedRet.a)
                throw new Error("TYPE ERROR: return type not matching")
            typedStmts.push({...stmt, ret: typedRet});

            break;
       /* case "if":
            const typedCond ...Expr  
            const typedThn ...Stmt[]
            const typedEls ...Stmt[] */
        case "pass":
            typedStmts.push({...stmt, a:Type.none});
            break;
        case "expr":
            const typedExpr = typeCheckExpr(stmt.expr, env);
            typedStmts.push({...stmt, expr: typedExpr, a: Type.none});
            break;
    }
})
    return typedStmts;
}

export function typeCheckParams(params: TypedVar<null>[]) : TypedVar<Type>[] {
    return params.map(param => 
         { return{ ...param, a: param.type}
        })
}

export function typeCheckExpr(expr: Expr<null>, env: TypeEnv) : Expr<Type> {
    switch(expr.tag){
        case "id":
            if(!env.vars.has(expr.name))
                throw new Error("TYPE CHECK: unbound id")
            const idType = env.vars.get(expr.name);
            return { ...expr, a: idType}
        
        case "builtin1":
            const arg1 = typeCheckExpr(expr.arg1, env);
            if(arg1.a !== Type.int)
                throw new Error("TYPE ERROR: arg1 must be int")
            return{ ...expr, arg1 : arg1, a: Type.int}

        case "builtin2":
            const arg1 = typeCheckExpr(expr.arg1, env);
            const arg2 = typeCheckExpr(expr.arg2, env);
            if(arg1.a !== Type.int)
                throw new Error("TYPE ERROR: arg1 must be int")
             if(arg2.a !== Type.int)
                 throw new Error("TYPE ERROR: arg2 must be int")
            return{ ...expr, arg1 : arg1, arg2 : arg2, a: Type.int}
        
        case "binaryexp":
            const left = typeCheckExpr(expr.left, env);
            const right = typeCheckExpr(expr.right, env);
            if(left.a !== Type.int)
                throw new Error("TYPE ERROR: Left must be int")
            if(right.a !== Type.int)
                throw new Error("TYPE ERROR: Right must be int")
            return{ ...expr, left : left, right : right, a: Type.int}
        
        case "call":
    
        case "literal":
            const lit = typeCheckLiteral(expr.literal)
            return { ...expr, a: lit.a}

    }

}


export function typeCheckLiteral(literal : Literal<null>) : Literal<Type> {
    switch(literal.tag){
        case "num":
            return { ...literal, a : Type.int};
        case "bool":
            return { ...literal, a: Type.bool};
        case "none":
            return { ...literal, a: Type.none};
    }

}