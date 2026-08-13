import { Module } from '@nestjs/common';

import { ProcedureController } from './procedure.controller';
import { ProcedureRepository } from './procedure.repository';

@Module({
  controllers: [ProcedureController],
  providers: [ProcedureRepository],
  exports: [ProcedureRepository],
})
export class ProcedureModule {}
