import { Module } from '@nestjs/common';

import { ProcedureController } from './procedure.controller';
import { ProcedureRepository } from './procedure.repository';
import { ProcedureService } from './procedure.service';

@Module({
  controllers: [ProcedureController],
  providers: [ProcedureRepository, ProcedureService],
  exports: [ProcedureRepository],
})
export class ProcedureModule {}
